# Solid access control wrapper for Fuseki endpoint
This repository contains a prototype for a wrapper service around a Fuseki Endpoint. The endpoint is intended to mirror the content of a Solid Pod, including the ACL files. In the ConSolid ecosystem, every document on a Solid Pod has its own access control document, which is also mirrorred to the SPARQL endpoint. This makes it straightforward to retrieve all resources a given requester has access to. The resulting list of resources is then injected as "FROM NAMED <>" in the original query sent by this requester. As a consequence, the query is only executed on a permitted union graph of Pod resources. Unauthenticated requests will result in querying the subset of resources on the Pod for which the public has been given Read access rights. 

The service only support basic SPARQL patterns: SELECT and CONSTRUCT. Queries including OPTIONAL, FILTER etc. are not yet supported. 

This code is developed in context of the Consolid research project and is part of the codebase at https://github.com/ConSolidProject/infrastructure.

## Usage
The satellite is bound to a specific Solid Pod/WebID. This repository contains a demo setup for 3 actors: architect, engineer and FM, each with their details in a file with environment variables (e.g. `env-architect.env`). Normally, each actor will have their own satellite. However, for testing purposes, one SPARQL store instance (where every actor gets their own database) suffices. 

* `npm install`
* Instantiate the 3 independent satellites in parallel with the command `npm run demo` (using the npm module "concurrently").
* SPARQL Queries can be sent to `http://localhost:{port defined in .env}/{username}/sparql`.
