const { translate, toSparql } = require( 'sparqlalgebrajs')
const fetch = require( 'node-fetch')
const { log } = require( '../logger')
const { selectConcept, selectRemoteRepresentation, selectLocalRepresentation, getReferenceRegistries } = require( './templates_fuseki')

async function getAllowedResources(req, res) {
  let actor
  if (!req.query.actor) {actor = req.auth.webId}
  else {actor = req.query.actor}
  // actor is owner
  // actor asks about himself (i.e. query actor and auth actor are the same or query actor is undefined)
  if (await checkOwnership(req.auth.webId, req.params.dataset) || req.auth.webId == req.query.actor || (req.auth.webId && req.query.actor === undefined) ) {
    const dataset = req.params.dataset
    const mode = `http://www.w3.org/ns/auth/acl#${capitalizeFirstLetter(req.params.mode)}`
    const allowed = await getPermissions(actor, mode, dataset).then(i => i.results.bindings.map(i => i.resource.value))

    res.status(200).send({allowed, mode})
  }

  else {
    res.status(403).send({message: "You are not allowed to get the permissions of this user for this dataset"})
  }
}  

async function getProjectDatasets(req, res) {
  const actor = req.auth.webId
  const dataset = req.params.dataset
  const project = req.body.project
  const distributionFilter = req.body.distributionFilter
  const datasetFilter = req.body.datasetFilter


  const mode = `http://www.w3.org/ns/auth/acl#Read`
  const allowed = await getPermissions(actor, mode, dataset).then(results => results.results.bindings.map(i => i.resource.value))
  let query = `PREFIX dcat: <http://www.w3.org/ns/dcat#>
  SELECT ?ds ?dURL WHERE {
      <${project}> dcat:dataset+ ?ds .
      ?ds dcat:distribution ?dist .
      ?dist dcat:accessURL ?dURL .
  `
  if (distributionFilter) {
    distributionFilter.forEach(filter => {
      let o
      if (filter.object.includes("http")) {
        o = `<${filter.object}>`
      } else {
        o = '"' + filter.object + '"'
      }
      query += `?dist <${filter.predicate}> ${o} .`
    })
  }

  if (datasetFilter) {
    datasetFilter.forEach(filter => {
      let o
      if (filter.object.includes("http")) {
        o = `<${filter.object}>`
      } else {
        o = '"' + filter.object + '"'
      }
      query += `?ds <${filter.predicate}> ${o} .`
    })
  }

  query += `}`

  const url = process.env.SPARQL_STORE_ENDPOINT + dataset + '/sparql';
  const data = await queryFuseki(query, url).then(i => i.json())
    .then(i => i.results.bindings.map(item => {return {dataset: item.ds.value, distribution: item.dURL.value}}))
  const filtered = data.filter(item => allowed.includes(item.dataset) && allowed.includes(item.distribution))
  res.status(200).send(filtered)
}
   
function adaptQuery(q, allowed, type) {
  let translation = translate(q)
  const bgp = findLowerLevel(translation)
  let wrapped
  let variables
  type = type.toLowerCase()
  if (type === "from named") {
    wrapped = {
      type: "graph",
      input: bgp.bgp,
      name: { 
        "termType": "Variable",
        "value": "g" 
      } ,
    }
  } else {
    wrapped = bgp.bgp
    variables = [...bgp.variables]
  }

  let input =       { 
      type: "project",
      input: wrapped,
      variables: [...bgp.variables]
    }

  if (translation.type == "slice") {
      input = {
          type: "slice", 
          input,
          start: translation["start"],
          length: translation.length
      }
  }

  const newQ = { 
    type: "from",
    input  
  }

  
  if (type === "from named") {
      newQ.named = allowed.map(i => { return { "termType": "NamedNode", "value": i } })
  } else {
    newQ.default = allowed.map(i => { return { "termType": "NamedNode", "value": i } })
  } 
 let query = toSparql(newQ)

  return query  

}

function findLowerLevel(obj, variables) {
  if (!variables) variables = obj.variables
  if (obj.type === "bgp") { 
      return {bgp: obj, variables}
  } else {
      return findLowerLevel(obj.input, variables)
  }    
}
 
async function query(req, res) {


  // get allowed subset
  const actor = req.auth.webId
  const dataset = req.params.dataset
  const mode = `http://www.w3.org/ns/auth/acl#Read`
  const startAllowed = new Date()
  const allowed = await getPermissions(actor, mode, dataset).then(results => results.results.bindings.map(i => i.resource.value))

  let q, queryType
  if (req.query && req.query.query) {
    q = req.query.query
    queryType = req.query.type
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
    queryType = req.body.type
  }

  if (!queryType) queryType = "from"

  let query
  if (!q) res.send("no query")

  // owner can query everything 
  const isOwner = await checkOwnership(actor, dataset)
  if (!isOwner) { 
    let translated
    try {
      translated = translate(q)
    } catch (error) {
      res.status(500).send({message: "Query could not be translated", error}) 
    }
    if (translated.type === "from") {
      translated.named.forEach(named => {
      })
      translated.default.forEach(named => {
        if (!allowed.includes(named)) console.log('named :>> ', named);
      })
      query = q
    } else {
      query = adaptQuery(q, allowed, queryType.toLowerCase())
    }
  } else {
    console.log("owner can query everything");
    query = q
  }
  console.log('query :>> ', query);
  const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
  const data = await queryFuseki(query, url)
  console.log('translate(query) :>> ', translate(query));
  let final
  if (query.toLowerCase().includes("construct")) {
    final = await data.text()
  }  
  else if (translate(query).type === "ask") {
    final = await data.json()
  } 
  else {
    res.set("Content-Type", "application/sparql-results+json")
    final = await data.json()
  }
  res.status(200).send(final)
 
  // log.info(query)
  // log.info(`Duration of retrieving subset of ${allowed.length} allowed graphs: ${durationAllowed}`)
  // log.info(`Duration of effective query: ${queryTime}`)
  // log.info(`Number of results: ${data.results.bindings.length}`)
}

async function checkOwnership(actor, dataset) {
  const query = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>

  ASK WHERE {
    {<${process.env.IDP}${dataset}/.acl#owner> acl:agent <${actor}> .} UNION
    {<${process.env.SPARQL_STORE_ENDPOINT}${dataset}/?graph=${process.env.IDP}${dataset}/.acl#owner> acl:agent <${actor}> .}
  }
  `
  const endpoint = process.env.SPARQL_STORE_ENDPOINT + dataset + "/sparql"
  const result = await queryFuseki(query, endpoint).then(i => i.json()).then(i => i.boolean)
  return result
}

async function getReferences(req, res) {
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
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(process.env.SPARQL_STORE_USERNAME + ":" + process.env.SPARQL_STORE_PW).toString('base64')}`
    },
    body: urlencoded,
  };

  const results = await fetch(endpoint, requestOptions)
  return results
}


async function getPermissions(agent, mode, dataset, filter = "") {
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

        ${filter}
      }`
  } else {
    query = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    SELECT DISTINCT ?resource
    WHERE {
     ?acl a acl:Authorization ; 
        acl:agentClass <http://xmlns.com/foaf/0.1/Agent> ;
        acl:mode <${mode}> .
      {?acl acl:accessTo ?resource} UNION {?acl acl:default ?resource }
      ${filter}
    }`}

  const url = process.env.SPARQL_STORE_ENDPOINT + dataset;
  const response = await queryFuseki(query, url).then(i => i.json()).catch(err => console.log('err', err))
  return response
}

async function checkDatasetExistence(dataset) {
  const requestOptions = {
      method: 'HEAD',
      headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(process.env.SPARQL_STORE_USERNAME + ":" + process.env.SPARQL_STORE_PW).toString('base64')}`
      },
  };

  const results = await fetch(process.env.SPARQL_STORE_ENDPOINT+dataset, requestOptions)
  return results.status
}

module.exports = {getPermissions, getReferences, query, getAllowedResources, checkDatasetExistence, getProjectDatasets}