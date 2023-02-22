import { translate, toSparql } from 'sparqlalgebrajs'
import fetch from 'node-fetch'

export async function getAllowedResources(req, res) {
    const actor = req.auth.webId

    const dataset = req.params.dataset
    const mode = `http://www.w3.org/ns/auth/acl#${capitalizeFirstLetter(req.params.mode)}`
    const allowed = await getPermissions(actor, mode, dataset)
    res.status(200).send(allowed)
}

export async function query(req, res) {
    // get allowed subset
    const actor = req.auth.webId
    const dataset = req.params.dataset
    const mode = `http://www.w3.org/ns/auth/acl#Read`
    const allowed = await getPermissions(actor, mode, dataset).then(results => results.results.bindings.map(i => i.resource.value))
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
    let translation = translate(q)
    const wrapped = {
        type: "graph",
        input: translation.input,
        name: {
            "termType": "Variable",
            "value": "g"
        }
    }
    const newQ:any = { type: "from", input: {type: "project", variables: translation.variables, input: wrapped} }
    newQ.named = allowed.map(i => { return { "termType": "NamedNode", "value": i } })
    let query = toSparql(newQ)
    const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
    const data = await queryFuseki(query, url).then(res => res.json())
    res.status(200).send(data)
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function queryFuseki(query, endpoint) {
    let urlencoded = new URLSearchParams();
    urlencoded.append("query", query)
    const requestOptions = {
        method: 'POST',
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
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
    const response = await queryFuseki(query, url).then(i=> i.json()).catch(err => console.log('err', err))
    return response
  }