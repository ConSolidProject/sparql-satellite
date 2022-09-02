# database-satellite-template
Generic Express.js template for an LBDserver satellite to sync data on a Pod with external databases. To be notified by a synchronisation satellite (https://github.com/LBD-Hackers/solid-synchronisation-satellite) 

One synchronisation route is exposed, accessible with 3 methods: 

* POST: add an RDF resource to the store
* DELETE: delete an RDF resource from the store
* UPDATE update an RDF resource on the store

It is possible to query a dataset with SPARQL. Use the "/:dataset/sparql" endpoint for this. The handling of queries to implement access-control is still under development