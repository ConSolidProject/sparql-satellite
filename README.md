# Solid access control wrapper for Fuseki endpoint
This repository contains a prototype for a wrapper service around a Fuseki Endpoint. The endpoint is intended to mirror the content of a Solid Pod, including the ACL files. For each triple pattern in a SPARQL query, the containing named graph is checked, and the access rights of the visitor are verified. If the visitor cannot see (part of) a specific result, this result is filtered out.

The service only support basic SPARQL patterns: SELECT and CONSTRUCT. Queries including OPTIONAL, FILTER etc. are not yet supported. 

This code is developed in context of the Consolid research project and is part of the codebase at https://github.com/ConSolidProject/infrastructure.

## Usage
The satellite is bound to a specific Solid Pod/WebID. This repository contains a demo setup for 3 actors: architect, engineer and FM, each with their details in a file with environment variables (e.g. `env-architect.env`). Normally, each actor will have their own satellite.

* `npm install`
* Instantiate the 3 independent satellites in parallel with the command `npm run demo` (using the npm module "concurrently").