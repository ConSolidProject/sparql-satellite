import { translate } from "sparqlalgebrajs"

const FormData = require('form-data')
const {v4} = require('uuid')
const {log} = require('../logger')
const fetch = require('node-fetch')

// send a SPARQL update to the SPARQL store
async function updateSparql(query, dataset) {
    console.log('updating', query)
    var urlencoded = new URLSearchParams();
    // urlencoded.append("update", query);
    var requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/sparql-update",
            "Authorization": "Basic " + Buffer.from(process.env.FUSEKI_USERNAME + ":" + process.env.ADMIN_PW).toString("base64")
        },
        body: query,
    };

    let response = await fetch(
        process.env.SPARQL_STORE_ENDPOINT + "/" + dataset + "/update",
        requestOptions
    );

    const text = await response.text();
    return text;
}

// get all graphs available in the SPARQL store
async function getAllGraphs(dataset) {
    const graphsInStore = await querySparql(
        `SELECT DISTINCT ?g WHERE {GRAPH ?g {?s ?p ?o}}`,
        dataset,
        "application/sparql-results+json",
        "project"
    );
    return graphsInStore.results.bindings.map((b) => b.g.value);
}

async function getAllDatasets() {
    const url = `${process.env.SPARQL_STORE_ENDPOINT}/$/datasets`
    const auth = 'Basic ' + Buffer.from(process.env.FUSEKI_USERNAME + ":" + process.env.ADMIN_PW).toString('base64')
    var requestOptions = {
        method: 'GET',
        headers: {
            "Authorization": auth
        },
      };

    const datasets = await fetch(url, requestOptions).then(res => res.json())
    return datasets 
}

// delete a resource in the SPARQL store
async function deleteResource(resource, dataset) {
    const query = `CLEAR GRAPH <${resource}>`;
    await updateSparql(query, dataset);
}

// upload a resource to the SPARQL store
async function uploadResource(data, graph, dataset, extension) {
    var formdata = new FormData();
    if (data.buffer) {
        formdata.append("file", data.buffer, data.originalname);
    } else {
        formdata.append(
            "file",
            Buffer.from(JSON.stringify(data)),
            `${v4()}.${extension}`
        );
    }
    var requestOptions = {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Connection": "keep-alive"
        },
        body: formdata,
    };

    let url = process.env.SPARQL_STORE_ENDPOINT + "/" + dataset;
    if (graph) url = url + `?graph=${graph}`;

    try {
        const response = await fetch(url, requestOptions);
        return response.status;
    } catch (error) {
        log.error(`error`, error);
    }
    return;
}

// upload a list of resources, filter RDF resources, check if they already exist on the triple store and if not, upload to the SPARQL store
async function uploadRdfToTripleStore(sync, options, dataset, fetch) {
    // try {
        for (const resource of sync) {
            let exists;
            if (!options.overwrite) {
                exists = await checkExistenceInTripleStore(resource, dataset);
            }
            if (options.overwrite || !exists) {
                console.log('fetch', fetch)
                const data = await fetch(resource, {
                    headers: { Accept: "application/ld+json" },
                }).catch(e => console.log(e));

                // content types to sync
                if (data.status === 200) {
                    await deleteResource(resource, dataset);
                    const text = await data.json();
                    await uploadResource(text, resource, dataset, "jsonld");
                    log.info(`Mirrored <${resource}>`)
                }
            } else {
                log.info(`<${resource}> already exists.`)
            }
        }
        return
//     } catch (error) {
//         log.error(`error`, error);
//     }
}


// upload a list of resources, filter RDF resources, check if they already exist on the triple store and if not, upload to the SPARQL store
async function uploadRdfToTripleStoreFromFileSystem(sync, options, dataset, fetch) {
    try {

        for (const resource of sync) {
            let exists;
            if (!options.overwrite) {
                exists = await checkExistenceInTripleStore(resource, dataset);
            }
            if (options.overwrite || !exists) {
                
            } else {
                log.info(`<${resource}> already exists.`)
            }
        }
    } catch (error) {
        log.error(`error`, error);
    }
}

// check the existence of a named graph in the SPARQL store
async function checkExistenceInTripleStore(named, dataset) {
    const result = await querySparql(
        `ASK WHERE { GRAPH <${named}> { ?s ?p ?o } }`,
        dataset,
        "",
        "project"
    );
    return result.boolean;
}

// perform a SPARQL query on the SPARQL store
async function querySparql(query, dataset, accept, type) {

    var urlencoded = new URLSearchParams();
    urlencoded.append("query", query);

    if (accept) { 
        const queryType = translate(query).type
        switch(queryType) {
            case "construct": accept = "application/ld+json"; break;
            case "project": accept = "application/sparql-results+json"; break;
            default: accept = accept
        }
    }

    var requestOptions = {
        method: "POST",
        headers: {
            "Accept": accept,
            "Authorization":  "Basic " + Buffer.from(process.env.FUSEKI_USERNAME + ":" + process.env.ADMIN_PW).toString("base64")
        },
        body: urlencoded
        
    };
    let url = process.env.SPARQL_STORE_ENDPOINT + "/" + dataset + "/sparql";


    url = url.replace(/#/g, "%23"); //you'll have to replace hash (replaceAll does not work here?)
    url = url.replace("+", "%2B"); //you'll have to replace hash (replaceAll does not work here?)
    try {
        const res = await fetch(url, requestOptions);
        if (res.status === 200) {
            const results = await res.json();
            return results;
        } else {
            return new Error('Something went wrong')
        }
    } catch (error) {
        log.error(`error`, error)
        return new Error('Something went wrong')
    }
}

async function createRepository(name) {
    const auth = 'Basic ' + Buffer.from(process.env.FUSEKI_USERNAME + ":" + process.env.ADMIN_PW).toString('base64')
    
    var requestOptions = {
      method: 'POST',
      headers: {
          "Authorization": auth
      },
    };
    
    fetch(`${process.env.SPARQL_STORE_ENDPOINT}/$/datasets?dbName=${name}&dbType=tdb2`, requestOptions)
      .then(response => response.text())
      .then(result => log.info(result))
      .catch(error => log.error('error', error));

    return
}

async function checkRepositoryExistence(name) {
    const auth = 'Basic ' + Buffer.from(process.env.FUSEKI_USERNAME + ":" + process.env.ADMIN_PW).toString('base64')
    
    var requestOptions = {
      method: 'HEAD',
      headers: {
          "Authorization": auth
      },
    };
    
    const status = fetch(`${process.env.SPARQL_STORE_ENDPOINT}/${name}`, requestOptions)
      .then(response => response.status)

    if (status === 200) {
        console.log(name, " exists")
        return true
    } else {
        console.log(name, "does not exist")
        return false
    }
}

export {querySparql, checkRepositoryExistence, checkExistenceInTripleStore, uploadRdfToTripleStore, updateSparql, uploadResource, deleteResource, getAllGraphs, createRepository, getAllDatasets}