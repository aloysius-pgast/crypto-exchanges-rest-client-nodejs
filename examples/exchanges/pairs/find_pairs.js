"use strict";

/*
This example show how to find pairs across all supported exchanges
 */
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = [
    {search:'NEO',type:'currency'},
    {search:'USDT',type:'baseCurrency'}
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
        arr.push(restClient.findPairs(e.search, e.type));
    });
    return Promise.all(arr).then((results) => {
        _.forEach(results, (list, index) => {
            console.log(`Found ${list.length} pairs matching ${JSON.stringify(opt[index])} (will only display 3 randomly)`);
            // display 3 random pairs
            let result = Helpers.getSample(list,3);
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
