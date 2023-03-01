import express from 'express'
import { log } from './logger'
import cors from 'cors'
import { query, getAllowedResources, getReferences} from "./controller"
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
 
app.get('/', (req, res) => {
    res.send('ok') 
})  

app.get('/:dataset/allowed/:mode', getAllowedResources)

// dataset query
app.post("/:dataset/sparql", query)

app.post("/:dataset/references", getReferences)

// dataset query
app.get("/:dataset/sparql", query)

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);
})