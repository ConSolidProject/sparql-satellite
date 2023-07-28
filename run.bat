env-cmd -f ./config/env-demo.env ts-node src/index.ts

PORT_SPARQL_SATELLITE=3010 SPARQL_STORE_USERNAME=admin SPARQL_STORE_PW=MiesIsDeMax SPARQL_STORE_ENDPOINT="https://fuseki.werbrouck.me/demo/" pm2 start ./src/index.js --name satellite