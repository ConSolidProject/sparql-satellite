import {log} from '../logger'
import {deleteResource, uploadResource, uploadRdfToTripleStore, getAllGraphs, getAllDatasets, querySparql, createRepository, checkRepositoryExistence} from '../functions'
import {queryPodUnion} from '../functions/queryAdapter'
import findRecursive from '../functions/storageLogic'

const { resolve } = require('path');
const { readdir } = require('fs').promises;

// functionality for uploading new resource to the satellite
async function syncResourceAdd(req, res) {
    let {url} = req.body 
    // 1. internal satellite logic to store graphs (e.g. one dataset per project, or multiple dataset per project, or the entire pod in one dataset etc.)
    const dataset = req.params.dataset
    // 2. get the resource and upload to triple store
    await uploadRdfToTripleStore([url], {overwrite: false}, dataset, req.fetch)

    // 3. post processing LBDserver: add distribution to Pod if it is a dataset

    res.status(201).send()
}

// functionality for deleting resource on the satellite
async function syncResourceDelete(req, res) {
    const {url} = req.body

    // 1. internal satellite logic to store graphs (e.g. one dataset per project, or multiple dataset per project, or the entire pod in one dataset etc.)
    const dataset = req.params.dataset

    // 2. delete the resource on this dataset
    await deleteResource(url, dataset)

    res.status(204).send()
}

// functionality for updating resource on the satellite
async function syncResourceUpdate(req, res) {
    const {url} = req.body
    const dataset = req.params.dataset
    await uploadRdfToTripleStore([url], {overwrite: true}, dataset, req.fetch)
    res.status(204).send()
}

async function getAllMirroredResources(req, res) {
    const datasets = await getAllDatasets().then(ds => ds.datasets.map(item => item["ds.name"].substring(1) ))
    const all = []
    for (const ds of datasets) {
        const items = await getAllGraphs(ds)
        all.push(items)
    }
    res.status(200).send(all.flat())
}

async function queryDatabase(req, res) {
    const results = await queryPodUnion(req, res)
    res.setHeader("Content-Type", "application/sparql-results+json")
    res.status(200).send(results)
}

async function getDataset(req, res) {
    res.status(200).send()
}

async function createDataset(req, res) {
    // if (req.auth.webId !== JSON.parse(process.env.ACCOUNT).webId) {
    //     console.log("hat nicht geklappt")
    //     res.status(401).send()
    // } else {
        const {repository} = req.body
        await createRepository(repository)
        res.status(201).send(repository)
    // }
}

export {syncResourceAdd, syncResourceDelete, syncResourceUpdate, queryDatabase, getDataset, getAllMirroredResources, createDataset}