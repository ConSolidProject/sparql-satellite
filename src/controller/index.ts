import { translate, toSparql } from 'sparqlalgebrajs'
import fetch from 'node-fetch'
import { log } from '../logger'
import { selectConcept, selectRemoteRepresentation, selectLocalRepresentation, getReferenceRegistries } from './templates_fuseki'

const theType = "from"

export async function getAllowedResources(req, res) {
  const actor = req.auth.webId

  const dataset = req.params.dataset
  const mode = `http://www.w3.org/ns/auth/acl#${capitalizeFirstLetter(req.params.mode)}`
  const allowed = await getPermissions(actor, mode, dataset)
  res.status(200).send(allowed)
} 

function adaptQuery(q, allowed, type) {
  let translation = translate(q)
  let wrapped
  let variables
  if (type === "from named") {
    wrapped = {
      type: "graph",
      input: translation.input,
      name: {
        "termType": "Variable",
        "value": "g" 
      } 
    }
    variables = [...translation.variables, { "termType": "Variable", "value": "g" }]
  } else {
    wrapped = translation.input
    variables = [...translation.variables]
  }

  const newQ: any = {
    type: "from",
    input:
    {
      type: "project", variables,
      input: wrapped,
    },

  }

  if (type === "from named") {
      newQ.named = allowed.map(i => { return { "termType": "NamedNode", "value": i } })
  } else {
    newQ.default = allowed.map(i => { return { "termType": "NamedNode", "value": i } })
  }
  let query = toSparql(newQ)
  return query

}

export async function query(req, res) {
  // get allowed subset
  const actor = req.auth.webId
  const dataset = req.params.dataset
  const mode = `http://www.w3.org/ns/auth/acl#Read`
  const startAllowed = new Date()
  const allowed = await getPermissions(actor, mode, dataset).then(results => results.results.bindings.map(i => i.resource.value))
  const endAllowed = new Date()
  const durationAllowed = endAllowed.getTime() - startAllowed.getTime()
  const startQuery = new Date()

  let q
  if (req.body && req.body.query) q = req.body.query
  if (req.query && req.query.query) {
    q = req.query.query
  } else if (req.body) {
    if (req.body.query) {
      q = req.body.query
    } else {
      try {
        q = Buffer.from(req.body).toString("utf8")
      } catch (error) {
        console.log('error', error)
      }
    }
  }

  if (!q) res.send("no query")
  const query = adaptQuery(q, allowed, theType)
  console.log(query)
  const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
  const data = await queryFuseki(query, url).then(res => res.json())
  const endQuery = new Date()
  const queryTime = endQuery.getTime() - startQuery.getTime()
  res.status(200).send(data)

  // log.info(query)
  // log.info(`Duration of retrieving subset of ${allowed.length} allowed graphs: ${durationAllowed}`)
  // log.info(`Duration of effective query: ${queryTime}`)
  // log.info(`Number of results: ${data.results.bindings.length}`)
}
 

export async function getReferences(req, res) {
  const actor = req.auth.webId
  const dataset = req.params.dataset
  const mode = `http://www.w3.org/ns/auth/acl#Read`
  const { references, project, referenceRegistry } = req.body
  const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
  if (!project && !referenceRegistry) {
    res.status(400).send({ missing: ["project", "referenceRegistry"] })
  }

  const allowed = await getPermissions(actor, mode, dataset).then(results => results.results.bindings.map(i => i.resource.value))
  let rr
  if (project && !referenceRegistry) {
    // get reference registry via project
    const query = getReferenceRegistries(project)
    rr = await queryFuseki(query, url).then(i => i.json()).then(i => i.results.bindings.map(item => item.refReg.value))
    // check access for reference registry
    rr = rr.filter(item => allowed.includes(item))
  } else if (referenceRegistry) {
    rr = [referenceRegistry]
  }

  const all = []
  for (const ref of references) {
    const results = await getReference(ref, rr, url)
    all.push(results)
  }

  res.send(all)


}

async function getReference(reference, registries, endpoint) {
  // const pod = JSON.parse(process.env.ACCOUNT).pod
  // const concept = adaptQuery(selectConcept(reference.activeDocument, reference.identifier, pod), registries)
  // const results = await queryFuseki(concept, endpoint).then(i => i.json())
  // const data = results.results.bindings
  // return results
}


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function queryFuseki(query, endpoint) {
  let urlencoded = new URLSearchParams();
  urlencoded.append("query", query)
  const requestOptions = {
    method: 'POST',
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: urlencoded,
  };

  const results = await fetch(endpoint, requestOptions)
  return results
}


export async function getPermissions(agent, mode, dataset) {
  let query
  if (agent) {
    query = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
      SELECT DISTINCT ?resource
      WHERE {
       ?acl a acl:Authorization ; 
          acl:mode <${mode}> .
        {?acl acl:accessTo ?resource} UNION {?acl acl:default ?resource }
        {?acl acl:agent <${agent}> . }
        UNION 
        {?acl acl:agentClass <http://xmlns.com/foaf/0.1/Agent>. }
      }`
  } else {
    query = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    SELECT DISTINCT ?resource
    WHERE {
     ?acl a acl:Authorization ; 
        acl:agentClass <http://xmlns.com/foaf/0.1/Agent> ;
        acl:mode <${mode}> .
      {?acl acl:accessTo ?resource} UNION {?acl acl:default ?resource }
    }`}

  const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
  const response = await queryFuseki(query, url).then(i => i.json()).catch(err => console.log('err', err))
  return response
}