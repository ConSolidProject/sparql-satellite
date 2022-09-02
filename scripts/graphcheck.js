const {fetch } = require('cross-fetch')
const {translate, toSparql} = require('sparqlalgebrajs')
const token = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6InZrS21tUTZRdEtEc1NLNWtCbkp5dmwzOElzeEpVSi1FSnIxMHdxN2RxQjAifQ.eyJ3ZWJpZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9kYy9wcm9maWxlL2NhcmQjbWUiLCJqdGkiOiJlVU83bnNTS1JKaEZJTHhsODlObU0iLCJzdWIiOiJkY18zN2JkOTRkYi03ZjU1LTQ5NTUtYTBmNC05NDViMzY3NDlkZDAiLCJpYXQiOjE2NTY0MTExMzEsImV4cCI6MTY1NzAxMTEzMSwic2NvcGUiOiJ3ZWJpZCIsImNsaWVudF9pZCI6ImRjXzM3YmQ5NGRiLTdmNTUtNDk1NS1hMGY0LTk0NWIzNjc0OWRkMCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8iLCJhdWQiOiJzb2xpZCJ9.P5hHomCnujY18TfppLuJsfBSwy35cG3brrLxwL1o-1kp_H96dn7XR76Zraghf_p-xk3PZ0LO2naOEc_g8oTraA";

var requestOptions = {
  method: 'GET',
  redirect: 'follow',
  headers: {
    "Authorization": token
  }
};

const endpoint = "http://localhost:5202/dc/sparql?query="
const query = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX acl: <http://www.w3.org/ns/auth/acl#>
PREFIX bot: <https://w3id.org/bot#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX lbds: <https://w3id.org/lbdserver#>
SELECT ?local ?label WHERE {
  	?accessPoint dcat:dataset ?local ; 
      a lbds:Project .
}`

function validateQuery(query) {
  const translation = translate(query);
    const newQuery = {
      type: "project",
      input: {
        type: "join",
        input: []
      },
      variables: translation.variables
    }
    const {bgp, variables} = findLowerLevel(translation, translation.variables)
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
    // const graphVar = { termType: 'Variable', value: graphVariable }
    // const theQ  = {type: "project", input: {type: "graph", input: bgp, name: graphVar }, variables: [...variables, graphVar]}
    // console.log('JSON.stringify(newQuery,undefined, 4)', JSON.stringify(newQuery,undefined, 4))
    const q = toSparql(newQuery)
    return q
    // return {query: newQuery, from: undefined, graphVariable}
}

function findLowerLevel(obj, variables) {
  if (!variables) variables = obj.variables
  if (obj.type === "bgp") { 
      return {bgp: obj, variables}
  } else {
      return findLowerLevel(obj.input, variables)
  }    
}


const webId = "http://localhost:3000/dc/profile/card#me"
const newQuery = validateQuery(query)
console.log('newQuery', newQuery)
let url = encodeURI(endpoint + newQuery).replaceAll('#', "%23")

async function run() {
  const set = new Set()
  const res = await fetch(url, requestOptions).then(response => response.json())
  res.results.bindings.forEach(item => {
    for (key of Object.keys(item)) {
      if (key.startsWith("graph_")) {
        set.add(item[key].value)
      }
    }
  })

  for (const acl of Array.from(set)) {
    const aclQuery = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    
    ASK {?authorization
          a acl:Authorization ;
          acl:accessTo <${acl}> ;
          acl:mode acl:Read .
  {?authorization acl:agent <${webId}> }
  UNION {?authorization acl:agentClass foaf:Agent }
    }`
    let aclUrl = encodeURI(endpoint + aclQuery).replaceAll('#', "%23")
    const can = await fetch(aclUrl, requestOptions).then(response => response.json()).then(i => i.boolean)
    if (!can) {
      throw new Error('Forbidden')
    }
  }
  console.log('res', res)
  return res
}

run()