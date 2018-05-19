"use strict";

/*
This example show how to send custom request to gateway
*/
const _ = require('lodash');
const Helpers = require('../lib/helpers');
const Client = require('../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

let opt = [
    // get uptime
    {path:'/server/uptime'},
    // retrieve a session
    {path:'/sessions/mySession'},
    // list exchanges supporting NEO as currency
    {path:'/exchanges', params:{currency:'NEO'}},
    // deletes a session
    {path:'/sessions/nonExistentSession', method:'DELETE'}
]

// first ensure gateway is running
restClient.ping().then((running) => {
    if (!running)
    {
        console.log(`Gateway is not running on '${baseUri}'`);
        process.exit(1);
    }
    // build promise list
    let arr = [];
    _.forEach(opt, (e) => {
        arr.push(restClient.customRequest(e.path, {method:e.method,params:e.params}));
    });
    return Promise.all(arr).then((results) => {
        _.forEach(results, (result, index) => {
            console.log(`Result for ${JSON.stringify(opt[index])} :`);
            console.log(Helpers.stringify(result) + "\n");
        });
    });
}).catch((err) => {
    if (restClient.isBaseError(err))
    {
        console.log(Helpers.stringify(err));
    }
    else
    {
        console.log(err);
    }
});
