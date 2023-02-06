import { discoverAcls, getAccessRightsAsk } from './accessControl'
import { translate, toSparql } from 'sparqlalgebrajs'
import { querySparql, updateSparql } from './index'
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad, variable } = DataFactory;
const fetch = require('node-fetch')

export async function queryPodUnion(req, res) {
  try {
    const actor = req.auth.webId
    const dataset = req.params.dataset
    let q
    if (req.body && req.body.query) q = req.body.query
    // if (req.query && req.query.query) {
    //   q = req.query.query
    // } else if (req.body) {
    //   if (req.body.query) {
    //     q = req.body.query
    //   } else {
    //     try {
    //       q = Buffer.from(req.body).toString("utf8")
    //     } catch (error) {
    //       console.log('error', error)
    //     }
    //   }
    // }

    let final, query, results, allowed
    const translated = translate(q)
    const type = translated.type
    if (type === "project") {
      if (translated.input.type === "graph") {
        const graph = translated.input.name.value
        
        const can = await checkNamedQuery(graph, actor, dataset)
        if (can) {
          results = await querySparql(q, dataset, req.headers.accept)
          return results
        } else {
          return {}
        }
        
      } else {
        query = validateSelectQuery(q)
        results = await querySparql(query, dataset, req.headers.accept)
        
        const set = new Set()
  
        results.results.bindings.forEach(item => {
          for (const k of Object.keys(item)) {
            if (k.startsWith("graph_")) {
              set.add(item[k].value)
            }
          }
        })
        allowed = await checkAccessRights(set, actor, dataset)     
        const final = results.results.bindings.map(binding => {
          const original = {}
          for (const key of Object.keys(binding)) {
            if (key.startsWith('graph_')) {
              if (!allowed.has(binding[key].value)) {
                return undefined
              }
            } else {
              original[key] = binding[key]
            }
          }
          return original
        })
        const response = {head: {vars: results.head.vars.filter(item => !item.includes('graph_'))}, results: {bindings: final}}
        return response
      }
    } else if (type === "construct") {
      query = validateConstructQuery(q)
      results = await querySparql(query ,dataset, req.headers.accept)
      const toCheck = await getContainer(results["@graph"])
      allowed = await checkAccessRights(toCheck, actor, dataset)
      if (isSubsetOf(allowed, toCheck)) {
        final = results
      } else {
        throw new Error(`You are not allowed to construct this query, as you do not have access rights to all the triples they reside in.`)
      }
    }


    return final
  } catch (error) {
    console.log(`error`, error)
    return new Error(error)
  }
}

async function queryFuseki(query, endpoint) {
  let urlencoded = new URLSearchParams();
  urlencoded.append("query", query)
  const requestOptions = {
      method: 'POST',
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: urlencoded,
  };

  const results = await fetch(`${endpoint}`, requestOptions)
  return results
}

async function checkNamedQuery(graph, actor, dataset) {
  const acl = graph + '.acl'
  const query = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
  
  ASK {
  GRAPH <${acl}> {
    {?authorization a acl:Authorization . }
    {?authorization acl:agent <${actor}> . } UNION { ?authorization acl:agentClass foaf:Agent }
     ?authorization  acl:mode acl:Read .
  }}`

  let url = process.env.SPARQL_STORE_ENDPOINT + "/" + dataset;

  const can = await queryFuseki(query, url).then(i=> i.json())
  return can.boolean
}

function isSubsetOf(set, subset) {
  const un = new Set([...Array.from(set), ...Array.from(subset)])
  return un.size == set.size;
}

function getContainer(graph) {
  return new Promise((resolve, reject) => {
    graph.forEach(i => {
      if (i["@id"] === "https://w3id.org/lbdserver#temporaryContainer") {
        if (i["http://www.w3.org/ns/ldp#contains"]) {
          let data
          if (Array.isArray(i["http://www.w3.org/ns/ldp#contains"])) {
            data = i["http://www.w3.org/ns/ldp#contains"].map(i => i["@id"])
          } else {
            data = [i["http://www.w3.org/ns/ldp#contains"]["@id"]]
          }
          const allowed = new Set(data)
          resolve(allowed)
        } else {
          reject()
        }

      }
    })
  })
}

async function checkAccessRights(set, actor, dataset) {
  let aclQuery
  if (actor) {
    aclQuery = `
    PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    
    SELECT ?acl ?resource ?default WHERE {
      GRAPH ?acl {
        ?authorization a acl:Authorization ;
        acl:accessTo ?resource ;
        acl:mode acl:Read .
        OPTIONAL {?authorization acl:default ?default }
        {
          ?authorization acl:agent <${actor}>
        } UNION {
          ?authorization acl:agentClass foaf:Agent
        }
      }
    } order by strlen(str(?resource))`
  } else {
    aclQuery = `PREFIX ac: <http://umbel.org/umbel/ac/>
    PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    
    SELECT ?acl ?resource ?default WHERE {
      GRAPH ?acl {
        ?authorization a acl:Authorization ;
        acl:accessTo ?resource ;
        acl:mode acl:Read .
        OPTIONAL {?authorization acl:default ?default }
          ?authorization acl:agentClass foaf:Agent
      }
    } order by strlen(str(?resource))`
  }

  const allAcls = await querySparql(aclQuery, dataset, "application/sparql-results+json")

  const allowed = new Set()
  allAcls.results.bindings.forEach(item => allowed.add(item.resource.value))
  return allowed
 
  // console.log('allowed', JSON.stringify(allowed, undefined, 4))

  // for (const resource of Array.from(set)) {
  //   let aclQuery
  //   if (actor) {
  //     aclQuery = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
  //         PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  //         PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
          
  //         ASK {?authorization
  //               a acl:Authorization ;
  //               acl:accessTo <${resource}> ;
  //               acl:mode acl:Read .
  //       {?authorization acl:agent <${actor}> }
  //       UNION {?authorization acl:agentClass foaf:Agent }
  //         }`
  //   } else {
  //     aclQuery = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
  //         PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  //         PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
          
  //         ASK {?authorization
  //               a acl:Authorization ;
  //               acl:accessTo <${resource}> ;
  //               acl:mode acl:Read ;
  //               acl:agentClass foaf:Agent .
  //         }`
  //   }

  //   const can = await querySparql(aclQuery, dataset, "application/sparql-results+json")
  //   if (!can) {
  //     notAllowed.add(resource)
  //   }
  // }

  // const final = results.results.bindings.map(binding => {
  //   const original = {}
  //   for (const key of Object.keys(binding)) {
  //     if (key.startsWith('graph_')) {
  //       if (!allowed.has(binding[key].value)) {
  //         return undefined
  //       }
  //     } else {
  //       original[key] = binding[key]
  //     }
  //   }
  //   return original
  // })
  // // if (Array.from(notAllowed).length > 0) {
  // //   // what to do if a resource cannot be seen? Don't send any results or filter them out?

  // //   throw new Error("Not allowed to access some of these resources")
  // // } else {
  //   return {head: {vars: results.head.vars.filter(item => !item.includes('graph_'))}, results: final}
  // // }
}

function validateConstructQuery(query) {
  const translation = translate(query);
  const newQuery: any = {
    type: "construct",
    input: {
      type: "join",
      input: []
    },
    template: [...translation.template]
  }
  const { bgp, variables } = findLowerLevel(translation, translation.variables)
  let added = 1
  for (const pattern of bgp.patterns) {
    // ask for named graph
    const graphVar = `graph_${added}`
    const name = {
      termType: "Variable",
      value: graphVar
    }
    const item = {
      type: "graph",
      input: {
        type: "bgp",
        patterns: [pattern],
      },
      name
    }
    newQuery.input.input.push(item)
    newQuery.template.push(graphTemplate(graphVar))
    added += 1
  }

  const q = toSparql(newQuery)
  return q
}

function graphTemplate(graph) {
  const myQ = quad(
    namedNode("https://w3id.org/lbdserver#temporaryContainer"),
    namedNode("http://www.w3.org/ns/ldp#contains"),
    variable(graph),
    defaultGraph(),
  )
  return myQ
}

function validateSelectQuery(query) {
  const translation = translate(query);
  const newQuery: any = {
    type: "project",
    input: {
      type: "join",
      input: []
    },
    variables: translation.variables
  }
  const { bgp, variables } = findLowerLevel(translation, translation.variables)
  let added = 1
  for (const pattern of bgp.patterns) {
    // ask for named graph
    const graphVar = `graph_${added}`
    const name = {
      termType: "Variable",
      value: graphVar
    }
    const item = {
      type: "graph",
      input: {
        type: "bgp",
        patterns: [pattern],
      },
      name
    }
    newQuery.input.input.push(item)
    newQuery.variables.push(name)

    // ask for ACL
    const aclVar = `acl_${added}`
    const aclVarName = {
      termType: "Variable",
      value: aclVar
    }

    added += 1
  }

  const q = toSparql(newQuery)
  return q
}

function findLowerLevel(obj, variables) {
  if (!variables) {
    if (obj && obj.variables) {
      variables = obj.variables
    } else {
      variables = undefined
    }
  }

  if (obj.type === "bgp") {
    return { bgp: obj, variables }
  } else {
    return findLowerLevel(obj.input, variables)
  }
} 