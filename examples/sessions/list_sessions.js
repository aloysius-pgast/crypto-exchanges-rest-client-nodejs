"use strict";

/*
This example show how to list existing RPC sessions
*/
const _ = require('lodash');
const Helpers = require('../lib/helpers');
const Client = require('../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

// first ensure gateway is running
restClient.ping().then((running) => {
    if (!running)
    {
        console.log(`Gateway is not running on '${baseUri}'`);
        process.exit(1);
    }
    return restClient.getSessions().then((data) => {
        console.log(`Found ${Object.keys(data).length} sessions (will only display 3 randomly)`);
        // display 3 random sessions
        let result = Helpers.getSample(data, 3);
        console.log(Helpers.stringify(result) + "\n");
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
