const p = require('./duplex.json')
const { selectConcept, selectRemoteRepresentation, selectLocalRepresentation } = require('./templates_fuseki')
const fetch = require('cross-fetch');
const { Headers } = fetch;
const QueryEngine = require('@comunica/query-sparql').QueryEngine

async function run() {
    let allDuration = 0

    await engine.query(`ASK {?s ?p ?o}`, { sources: p.map(i => i.referenceRegistry) })
    const now = new Date()
    const queryResults = await queryProject()
    const query = new Date()

    console.log("duration of query task: ", query.getTime() - now.getTime())

    for (let i = 0; i < iterations; i++) {
        const concepts = []

        for (const r of queryResults) {
            const startPropagation = new Date()
            const concept = await findConceptById(r)
            if (concept.length) {
                const final = {
                    aliases: new Set(),
                    references: []
                }
                concept.forEach(reference => {
                    final.aliases.add(reference.concept.value)
                    if (reference.alias) final.aliases.add(reference.alias.value)
                    final.references.push({
                        reference: reference.reference.value,
                        identifier: reference.value.value,
                        document: reference.doc.value
                    })
                })
                final.aliases = Array.from(final.aliases)
                concepts.push(final)
                const propagate = new Date()
                const duration = propagate.getTime() - startPropagation.getTime()
                allDuration += duration
                // console.log('final', final)
                // console.log('duration', duration)
            }
        }
        // console.log('concepts', concepts)

    }

    const averageDuration = allDuration / iterations
    const averageDurationPerConcept = allDuration / (queryResults.length * iterations)
    console.log('allDuration', allDuration)
    console.log('averageDuration', averageDuration)
    console.log('averageDurationPerConcept', averageDurationPerConcept)
}

async function findConceptById(concept) {
    const t1 = new Date()
    const conceptInfo = await queryConcept(concept)
    const t2 = new Date()
    // console.log('concept query', t2-t1)
    const alreadyQueried = []
    const all = []
    for (const ref of conceptInfo) {
        if (!alreadyQueried.includes(ref.local)) {
            const t3 = new Date()
            const local = await queryLocalReferences(ref, concept)
            if (local.length) all.push(local)
            alreadyQueried.push(ref.local)
            const t4 = new Date()
            // console.log('reference', t4-t3)
        }
        if (ref.alias) {
            if (!alreadyQueried.includes(ref.alias)) {
                const t5 = new Date()
                const remote = await queryRemoteReferences(ref)
                if (remote.length) all.push(remote)
                alreadyQueried.push(ref.alias)
                const t6 = new Date()
                // console.log('alias', t6-t5)

            }

        }
    }
    return all.flat()
}

async function queryLocalReferences(ref, concept) {
    let referenceRegistry = ref.concept.value
    const hashindex = referenceRegistry.indexOf('#')
    referenceRegistry = referenceRegistry.replace(referenceRegistry.substring(hashindex, referenceRegistry.length), "");
    const query = selectLocalRepresentation(ref.local.value, ref.concept.value, referenceRegistry)
    const reference = []
    let results
    if (method == "remote") results = await queryFuseki(query, concept.owner[option])
    else results = await queryComunica(query, referenceRegistry)
    results.results.bindings.forEach(binding => reference.push(binding))
    return reference
}

async function queryRemoteReferences(ref) {
    let referenceRegistry = ref.alias.value
    const hashindex = referenceRegistry.indexOf('#')
    referenceRegistry = referenceRegistry.replace(referenceRegistry.substring(hashindex, referenceRegistry.length), "");
    const query = selectRemoteRepresentation(ref.alias.value, ref.concept.value, referenceRegistry)
    const podToEndpoint = {}

    p.forEach(i => {
        podToEndpoint[i.pod] = i[option]
    })

    const pod = getRoot(ref.alias.value)
    const reference = []
    let results
    if (method == "remote") results = await queryFuseki(query, podToEndpoint[pod])
    else results = await queryComunica(query, podToEndpoint[pod])
    results.results.bindings.forEach(binding => reference.push(binding))
    return reference
}

async function queryConcept(concept) {
    const query = selectConcept(concept.activeDocument, concept.identifier, concept.owner)
    const endpoints = p.map(i => i[option])
    const projectConcept = []
    let referenceRegistry = concept.owner.referenceRegistry
    for (const endpoint of endpoints) {
        let results
        if (method == "remote") results = await queryFuseki(query, endpoint)
        else results = await queryComunica(query, referenceRegistry)
        console.log('results', results)
        if (results && results.results.bindings.length) results.results.bindings.forEach(binding => projectConcept.push(binding).value)
    }
    return projectConcept
}

async function queryComunica(query, source) {
    const result = await engine.query(query, { sources: [source] })
    const { data } = await engine.resultToString(result, 'application/sparql-results+json');
    const asJSON = await streamToString(data)
    // engine.invalidateHttpCache()
    return JSON.parse(asJSON)
}

function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        stream.on('error', err => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
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

async function queryProject() {
    const propagateVariables = ["el"]
    const endpoints = p.map(i => i.endpoint)
    const allResults = []
    const podToEndpoint = {}

    p.forEach(i => {
        podToEndpoint[i.endpoint] = i
    })

    let myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    let urlencoded = new URLSearchParams();
    urlencoded.append("query", query)
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: urlencoded,
    };

    for (const endpoint of endpoints) {
        const url = `${endpoint}`
        const results = await fetch(url, requestOptions).then(response => response.json())

        results.results.bindings.forEach(binding => {
            Object.keys(binding).forEach(key => {
                if (propagateVariables.includes(key) && binding[key].value) {
                    allResults.push({ identifier: binding[key].value, activeDocument: binding["g"].value, owner: podToEndpoint[endpoint] })
                }
            })
        })
    }
    return allResults
}

function getRoot(resource) {
    let root = resource.split('/').slice(0, resource.split('/').length - 1);
    root = root.join('/');
    if (!root.endsWith('/')) root += '/';
    return root;
}

console.log('start')
run().then(() => {
    // const end = new Date()
    // console.log("duration: ", end.getTime() - now.getTime())
})
