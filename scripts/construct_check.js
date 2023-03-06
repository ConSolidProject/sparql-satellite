const { fetch } = require('cross-fetch')
const { translate, toSparql } = require('sparqlalgebrajs')
const token = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6InZrS21tUTZRdEtEc1NLNWtCbkp5dmwzOElzeEpVSi1FSnIxMHdxN2RxQjAifQ.eyJ3ZWJpZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9kYy9wcm9maWxlL2NhcmQjbWUiLCJqdGkiOiI1QnNUbXYyVi1QUDR4N1ZTSFdRajIiLCJzdWIiOiJkY180NDBlYTAzMC00N2VmLTQ4Y2UtOGE2MS1jMWE0Mjc3ZDljNjgiLCJpYXQiOjE2NTY1OTU4MTYsImV4cCI6MTY1NzE5NTgxNiwic2NvcGUiOiJ3ZWJpZCIsImNsaWVudF9pZCI6ImRjXzQ0MGVhMDMwLTQ3ZWYtNDhjZS04YTYxLWMxYTQyNzdkOWM2OCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8iLCJhdWQiOiJzb2xpZCJ9.lDkmBrGyFt-hNUSECOFsp764iJQQha7_RGotnuSFRmgC20h0dFMgQnRDFc6thpKGh8CB5NmNB5w9L2IRhf9dZA";
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad, variable } = DataFactory;
var requestOptions = {
  method: 'GET',
  redirect: 'follow',
  headers: {
    "Authorization": token
  }
};

const endpoint = "http://localhost:5202/dc/sparql?query="

const first = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX lbds: <https://w3id.org/lbdserver#>
CONSTRUCT {?accessPoint a lbds:Project; dcat:dataset ?ds} WHERE {
  	?accessPoint a lbds:Project ;
     dcat:dataset ?ds .
}`
const query = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX acl: <http://www.w3.org/ns/auth/acl#>
PREFIX bot: <https://w3id.org/bot#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX lbds: <https://w3id.org/lbdserver#>
CONSTRUCT {?accessPoint a lbds:Project; 
  dcat:dataset ?ds.
<http://localhost:5202/dc/sparql> <https://w3id.org/lbdserver#includesGraph> ?g1, ?g2 .
} WHERE {
  	GRAPH ?g1 {?accessPoint a lbds:Project .}
    GRAPH ?g2 {?accessPoint dcat:dataset ?ds .}
}`

function graphTemplate(graph) {
  const myQ = quad(
    namedNode("https://w3id.org/lbdserver#temporaryContainer"),
    namedNode("http://www.w3.org/ns/ldp#"),
    variable(graph),
    defaultGraph(),
  )
  return myQ
}

function validateQuery(query) {
  const translation = translate(query);
  console.log('translation', JSON.stringify(translation, undefined, 4))
  const newQuery = {
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


const webId = "http://localhost:3000/dc/profile/card#me"
const newQuery = validateQuery(first)
let url = encodeURI(endpoint + newQuery).replaceAll('#', "%23")


async function run() {
  const set = new Set()
  const res = await fetch(url, requestOptions).then(response => response.json())
  console.log('res', res)
  return res
}

run()