import { discoverAcls, getAccessRightsAsk } from './accessControl'
import { translate, toSparql } from 'sparqlalgebrajs'
import { querySparql, updateSparql } from './index'
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad, variable } = DataFactory;


export async function queryPodUnion(req, res) {
  try {
    const actor = req.auth.webId
    const dataset = req.params.dataset
    let q
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
    console.log('query', q)
    let final, query, results, allowed
    const type = translate(q).type
    if (type === "project" || type === "slice") {
      query = validateSelectQuery(q)
      console.log('query', query)
      results = await querySparql(query, dataset, req.headers.accept, type)
      const set = new Set()
      console.log('query', query)
      results.results.bindings.forEach(item => {
        for (const k of Object.keys(item)) { 
          if (k.startsWith("graph_")) {
            set.add(item[k].value)
          }
        }
      })
      allowed = await checkAccessRights(set, actor, dataset)
      console.log('allowed', allowed)     
      const final = results.results.bindings.map(binding => {
        const original = {}
        for (const key of Object.keys(binding)) {
          if (key.startsWith('graph_')) {
            if (!allowed.has(binding[key].value)) {
              console.log('binding[key].value', key, binding[key].value)
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
    } else if (type === "construct") {
      query = validateConstructQuery(q)
      console.log('query', query)
      results = await querySparql(query ,dataset, req.headers.accept, type)
      console.log('results', results)
      const toCheck = await getContainer(results["@graph"])
      allowed = await checkAccessRights(toCheck, actor, dataset)
      if (isSubsetOf(allowed, toCheck)) {
        final = results
      } else {
        throw new Error(`You are not allowed to construct this query, as you do not have access rights to all the triples they reside in.`)
      }
    }

    console.log('final', final)
    return final
  } catch (error) {
    console.log(`error`, error)
    return new Error(error)
  }
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

  const allAcls = await querySparql(aclQuery, dataset, "application/sparql-results+json", "project")

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
  console.log('JSON.strinfigy(translation, undefined, 4)', JSON.stringify(translation, undefined, 4))
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
  console.log('translation', translation)
  const type = translation.type
  let newQuery: any = {
    type: "project",
    input: {
      type: "join",
      input: []
    },
    variables: translation.variables || translation.input.variables
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

  if (type === "slice") {
    newQuery = {...translation, input: newQuery}
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
    console.log('obj', obj)
    return findLowerLevel(obj.input, variables)
  }
} 