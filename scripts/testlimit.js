const {translate, toSparql} = require('sparqlalgebrajs')

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
            start: translation.start,
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

    console.log('JSON.stringify(newQ, undefined, 4) :>> ', JSON.stringify(newQ, undefined, 4));

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
  
const query = `SELECT ?refReg WHERE {
    <https://pod.werbrouck.me/architect/0c39ccf8-b17e-47d8-a1d7-49a71c1a342f> <http://www.w3.org/ns/dcat#dataset> ?ds .
    ?ds a <https://w3id.org/consolid#ReferenceRegistry> ;
        <http://www.w3.org/ns/dcat#distribution>/<http://www.w3.org/ns/dcat#downloadURL> ?refReg.
}`

const newQ = adaptQuery(query, ["https://mygraph.com"], "FROM")
console.log('newQ :>> ', newQ);