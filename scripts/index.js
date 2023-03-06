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
  const webId = "http://localhost:3000/dc/profile/card#me"
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
      // const aclRule = {
      //   type: "graph",
      //   input: {
      //     type: "join",
      //     input: [{
      //       type: "bgp",
      //       patterns: [
      //           {
      //               "termType": "Quad",
      //               "value": "",
      //               "subject": {
      //                   "termType": "Variable",
      //                   "value": "r1"
      //               },
      //               "predicate": {
      //                   "termType": "NamedNode",
      //                   "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
      //               },
      //               "object": {
      //                   "termType": "NamedNode",
      //                   "value": "http://www.w3.org/ns/auth/acl#Authorization"
      //               },
      //               "graph": {
      //                   "termType": "DefaultGraph",
      //                   "value": ""
      //               },
      //               "type": "pattern"
      //           },
      //           {
      //               "termType": "Quad",
      //               "value": "",
      //               "subject": {
      //                   "termType": "Variable",
      //                   "value": "r1"
      //               },
      //               "predicate": {
      //                   "termType": "NamedNode",
      //                   "value": "http://www.w3.org/ns/auth/acl#accessTo"
      //               },
      //               "object": {
      //                   "termType": "Variable",
      //                   "value": graphVar
      //               },
      //               "graph": {
      //                   "termType": "DefaultGraph",
      //                   "value": ""
      //               },
      //               "type": "pattern"
      //           },
      //           {
      //               "termType": "Quad",
      //               "value": "",
      //               "subject": {
      //                   "termType": "Variable",
      //                   "value": "r1"
      //               },
      //               "predicate": {
      //                   "termType": "NamedNode",
      //                   "value": "http://www.w3.org/ns/auth/acl#mode"
      //               },
      //               "object": {
      //                   "termType": "NamedNode",
      //                   "value": "http://www.w3.org/ns/auth/acl#Read"
      //               },
      //               "graph": {
      //                   "termType": "DefaultGraph",
      //                   "value": ""
      //               },
      //               "type": "pattern"
      //           }
      //       ]
      //   }]
      //   },
      //   name: aclVarName
      // }

      // if (webId) {
      //   aclRule.input.input.push({
      //     "type": "union",
      //     "input": [
      //         {
      //             "type": "bgp",
      //             "patterns": [
      //                 {
      //                     "termType": "Quad",
      //                     "value": "",
      //                     "subject": {
      //                         "termType": "Variable",
      //                         "value": "r1"
      //                     },
      //                     "predicate": {
      //                         "termType": "NamedNode",
      //                         "value": "http://www.w3.org/ns/auth/acl#agentClass"
      //                     },
      //                     "object": {
      //                         "termType": "NamedNode",
      //                         "value": "http://xmlns.com/foaf/0.1/Agent"
      //                     },
      //                     "graph": {
      //                         "termType": "DefaultGraph",
      //                         "value": ""
      //                     },
      //                     "type": "pattern"
      //                 }
      //             ]
      //         },
      //         {
      //             "type": "bgp",
      //             "patterns": [
      //                 {
      //                     "termType": "Quad",
      //                     "value": "",
      //                     "subject": {
      //                         "termType": "Variable",
      //                         "value": "r1"
      //                     },
      //                     "predicate": {
      //                         "termType": "NamedNode",
      //                         "value": "http://www.w3.org/ns/auth/acl#agent"
      //                     },
      //                     "object": {
      //                         "termType": "NamedNode",
      //                         "value": webId
      //                     },
      //                     "graph": {
      //                         "termType": "DefaultGraph",
      //                         "value": ""
      //                     },
      //                     "type": "pattern"
      //                 }
      //             ]
      //         }
      //     ]
      // })
      // } else {
      //   aclRule.input.input.patterns.push({
      //     "termType": "Quad",
      //     "value": "",
      //     "subject": {
      //         "termType": "Variable",
      //         "value": "r1"
      //     },
      //     "predicate": {
      //         "termType": "NamedNode",
      //         "value": "http://www.w3.org/ns/auth/acl#agentClass"
      //     },
      //     "object": {
      //         "termType": "NamedNode",
      //         "value": "http://xmlns.com/foaf/0.1/Agent"
      //     },
      //     "graph": {
      //         "termType": "DefaultGraph",
      //         "value": ""
      //     },
      //     "type": "pattern"
      // })
      // }

      // newQuery.input.input.push(aclRule)
      // newQuery.variables.push(aclVarName)
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

const newQuery = validateQuery(query)
console.log('newQuery', newQuery)
let url = encodeURI(endpoint + newQuery).replaceAll('#', "%23")

fetch(url, requestOptions)
  .then(response => response.json())
  .then(result => console.log(JSON.stringify(result, undefined, 4)))
  .catch(error => console.log('error', error));