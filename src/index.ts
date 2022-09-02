import express from 'express'
import { log } from './logger'
import cors from 'cors'
import { syncResourceAdd, syncResourceDelete, syncResourceUpdate, queryDatabase, getDataset, getAllMirroredResources, createDataset } from "./controller"
import generateFetch from './functions/auth'
import {fetch} from 'cross-fetch'
import bodyParser from 'body-parser'

import { extractWebId, setSatellite } from "express-solid-auth-wrapper"

const port = process.env.PORT_SPARQL_SATELLITE

const app = express();
app.use(cors())
app.use(express.json());

var options = {
    inflate: true,
    limit: '100kb',
    type: 'application/sparql-update'
};

app.use(bodyParser.raw(options));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

// set satellite authenticated session as req.session
app.use(extractWebId)
app.use(setSatellite(JSON.parse(process.env.ACCOUNT)))
 
// app.use((req, res, next) => {
//     res.append('Access-Control-Allow-Origin', ['*']);
//     res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//     res.append('Access-Control-Allow-Headers', 'Content-Type');
//     next();
// });

  
app.post('/', createDataset)
app.get('/', (req, res) => {
    res.send('ok') 
}) 

// dataset query
app.post("/:dataset/sparql", queryDatabase)

// dataset query
app.get("/:dataset/sparql", queryDatabase)

app.patch("/:dataset/sparql", queryDatabase)
app.put("/:dataset", queryDatabase)

// dataset retrieval
app.get("/:dataset/get", getDataset)

// the satellite is notified of a new resource on the Pod
app.post("/:dataset/upload", syncResourceAdd)

// the satellite is notified that a resource has been removed from the Pod
app.delete("/:dataset/delete", syncResourceDelete)

// the satellite is notified a resource on the Pod has been updated
app.patch("/:dataset/upload", syncResourceUpdate)

// get a list of all mirrored resources
app.get('/all', getAllMirroredResources)

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);
})