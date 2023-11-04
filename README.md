# Solid access control wrapper for Fuseki endpoint - "SPARQL satellite"
This repository contains a prototype for a SPARQL satellite in the ConSolid ecosystem [Werbrouck et al., 2023](https://content.iospress.com/articles/semantic-web/sw233396), i.e., a wrapper service around a Fuseki Endpoint.
The service only support basic SPARQL patterns: SELECT and CONSTRUCT. Queries including OPTIONAL, FILTER etc. are not yet supported. 

## Initialisation
* Create a .env file in the `config` folder (or adapt the template provided in `local.env`). The following fields should be included:
```PORT_SPARQL_SATELLITE=3001
SPARQL_STORE_USERNAME=admin
SPARQL_STORE_PW=pw
IDP=http://localhost:3000/
SPARQL_STORE_ENDPOINT=http://localhost:3030/```

* Run ```npm install```
* Run ```npm run start```

* Make sure each WebID has a new property attached to find their SPARQL satellite. This can be done by adding the following triple to their WebID:
```<#me> <https://w3id.org/consolid#hasSparqlSatellite> <http://localhost:3001/{podname}/sparql>.```

## Authentication
* Request a client secret (response.secret) and an id (response.id) from the Solid Community Server. 
```curl --location 'http://localhost:3000/idp/credentials/' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "example@example.org",
    "password": "test123",
    "name": "demo"
}'```

* Request a token with {id:secret} as a base64 encoded Basic Auth value. Your token can be found in (response.access_token)
```curl --location 'http://localhost:3000/.oidc/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--header 'Authorization: Basic {base64{id:secret}} \
--data-urlencode 'grant_type=client_credentials' \
--data-urlencode 'scope=webid'```

* You can now use the token in your requests as a Bearer token: 
```--header 'Authorization: Bearer {access_token}'```

## API documentation
Replace `[PORT]` with the port number where the server is running.

### Content Types
- Application/JSON for responses
- Application/SPARQL-UPDATE for specific update requests

## Endpoints
### Dataset Existence
- `HEAD /:dataset/sparql`
  - Description: Checks if a dataset exists.
  - URL Params:
    - `dataset`: The dataset to check.
  - Responses:
    - `200 OK`: Dataset exists.
    - `404 Not Found`: Dataset does not exist.

### Allowed Resources
- `GET /:dataset/allowed/:mode`
  - Description: Retrieves resources allowed for a given mode on a dataset.
  - URL Params:
    - `dataset`: The target dataset name. This will resolve to the name of the Pod. If your Pod is called `bob`, the dataset parameter will be `bob`. 
    - `mode`: The mode for which allowed resources are retrieved (`Read`, `Write`, etc.).
  - Query Params:
    - `actor` (optional): The actor's webId. If not provided, the authenticated user's webId is used. The response will only be valid if 1. the authenticated user is the owner of the Pod; or 2. if the authenticated user and the `actor` are the same.
  - Responses:
    - `200 OK`: Returns a JSON response with a list of allowed resources ("allowed") and mode ("mode").
    - `403 Forbidden`: User is not allowed to get the permissions for this dataset.

### Project Datasets
- `POST /:dataset/datasets`
  - Description: Retrieves datasets related to a project.
  - URL Params:
    - `dataset`: The target dataset name.
  - Request Body: JSON object with `project`, `distributionFilter`, and `datasetFilter`. Project includes the main access point URL (DCAT Catalog) of the project. `distributionFilter` and `datasetFilter` are a list of the form [{predicate, object}], and resolve to triples applying to respectively DCAT distributions or DCAT datasets to filter.
  - Responses:
    - `200 OK`: Returns a list of project datasets.

### Dataset Query
- `GET /:dataset/sparql`
  - Description: Queries a dataset using SPARQL via query params.
  - URL Params:
    - `dataset`: The target dataset name. This will resolve to the name of the Pod. If your Pod is called "bob", the dataset parameter will be "bob". 
  - Query Params:
    - `query`: The SPARQL query string.
    - `type`: The query type (FROM or FROM NAMED). If there is no "type" parameter, by default "FROM" will be selected. "FROM" effectively queries the permitted Pod Union, but also the slowest option. 
  - Responses:
    - `200 OK`: Returns the result of the query.

- `POST /:dataset/sparql`
  - Description: Queries a dataset using SPARQL via request body.
  - URL Params:
    - `dataset`: The target dataset name. This will resolve to the name of the Pod. If your Pod is called `bob`, the dataset parameter will be `bob`. 
  - Request Body: JSON object with `query` (the SPARQL query - SELECT or CONSTRUCT) and `type` of the query. The query type can be FROM or FROM NAMED. If there is no "type" parameter, by default "FROM" will be selected. "FROM" effectively queries the permitted Pod Union, but also the slowest option.
  - Responses:
    - `200 OK`: Returns the result of the query.

## Server Startup
- The server listens on the port specified in the `PORT_SPARQL_SATELLITE` environment variable.
