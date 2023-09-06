const { translate } = require("sparqlalgebrajs")

const q = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
SELECT ?ds WHERE {
    <http://localhost:3000/architect-duplex/8ed91c3c-ba57-444e-bee6-28a7b20fc7f4> dcat:dataset+ ?ds
}`

const t = translate(q)
console.log('t :>> ', JSON.stringify(t, null, 2));