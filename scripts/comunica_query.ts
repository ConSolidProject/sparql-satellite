import { translate, toSparql } from 'sparqlalgebrajs'
import { QueryEngine } from '@comunica/query-sparql'
import { createSolidTokenVerifier } from '@solid/access-token-verifier'
import generateFetch from '../src/functions/auth'
import { verifySolidAccessToken } from '@solid/access-token-verifier/dist/algorithm/verifySolidAccessToken'
import { SolidNodeClient } from 'solid-node-client'
var solidOidcAccessTokenVerifier = createSolidTokenVerifier()

const token = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6InZrS21tUTZRdEtEc1NLNWtCbkp5dmwzOElzeEpVSi1FSnIxMHdxN2RxQjAifQ.eyJ3ZWJpZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9kYy9wcm9maWxlL2NhcmQjbWUiLCJqdGkiOiJlVU83bnNTS1JKaEZJTHhsODlObU0iLCJzdWIiOiJkY18zN2JkOTRkYi03ZjU1LTQ5NTUtYTBmNC05NDViMzY3NDlkZDAiLCJpYXQiOjE2NTY0MTExMzEsImV4cCI6MTY1NzAxMTEzMSwic2NvcGUiOiJ3ZWJpZCIsImNsaWVudF9pZCI6ImRjXzM3YmQ5NGRiLTdmNTUtNDk1NS1hMGY0LTk0NWIzNjc0OWRkMCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8iLCJhdWQiOiJzb2xpZCJ9.P5hHomCnujY18TfppLuJsfBSwy35cG3brrLxwL1o-1kp_H96dn7XR76Zraghf_p-xk3PZ0LO2naOEc_g8oTraA";

async function getAuthFetch(config) {
    try {
        let afetch
        const { email, password, idp } = config
        afetch = await generateFetch(email, password, idp)
        return afetch
    } catch (error) {
        console.log(`error`, error)
    }
}

const config = {
    email: "dc@arch.rwth-aachen.de",
    password: "test123",
    idp: "http://localhost:3000"
}

async function run() {
    const myFetch = await getAuthFetch(config)
    const engine = new QueryEngine()
//     const result = await engine.query(`
//   SELECT ?s ?p ?o WHERE {
//     ?s ?p <http://dbpedia.org/resource/Belqsdfqsdfqsdfgium>.
//     ?s ?p ?o
//   } LIMIT 100`, {
//   sources: ['http://localhost:3030/dc/sparql'],
// });

    const query: any = `SELECT * WHERE {?s <http://www.w3.org/ns/dcat#dataset> ?o}`
    const result = await engine.query(query, { sources: ["http://localhost:5202/dc/sparql"], fetch: myFetch })
    const { data } = await engine.resultToString(result, 'application/sparql-results+json');
    const asJSON = await streamToString(data)
    console.log('asJSON', asJSON)
}

function streamToString(stream: any): Promise<string> {
    const chunks: any = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk: any) => {
            chunks.push(Buffer.from(chunk));
            return;
        });
        stream.on("error", (err: Error) => {
            console.log("error", err);
            reject(err);
        });
        stream.on("end", () => {
            console.log("end");
            if (chunks.length > 0) {
                resolve(Buffer.concat(chunks).toString("utf8"));
            } else {
                reject("could not find length");
            }
        });
    });
}

const start = new Date()
run()
    .then(() => {
        const end = new Date()

        const duration = end.getTime() - start.getTime()
        console.log('duration', duration)
        process.exit(0)
    })
    .catch(err => {
        console.log('err', err)
        process.exit(1)
    })