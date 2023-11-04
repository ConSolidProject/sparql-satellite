const express = require( 'express')
const { log } = require( './logger')
const cors = require( 'cors')
const { query, getAllowedResources, getReferences, checkDatasetExistence, getProjectDatasets} = require( "./controller")
const bodyParser = require( 'body-parser')
const { extractWebId } = require("express-solid-auth-wrapper")
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
// app.use(setSatellite(JSON.parse(process.env.ACCOUNT)))

app.get('/:dataset/allowed/:mode', getAllowedResources)

// app.post("/:dataset/references", getReferences)

app.post("/:dataset/datasets", getProjectDatasets)

// HEAD request to see if dataset exists
app.head("/:dataset/sparql", async (req, res) => {
    const available = await checkDatasetExistence(req.params.dataset)
    res.status(available).send()
})

// dataset query
app.get("/:dataset/sparql", query) 
app.post("/:dataset/sparql", query)

 

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);
})    