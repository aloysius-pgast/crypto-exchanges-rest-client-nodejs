"use strict";

/*
This example show how to retrieve an existing RPC session
*/
const _ = require('lodash');
const Helpers = require('../lib/helpers');
const Client = require('../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const sessionId = 'mySession';

// first ensure gateway is running
restClient.ping().then((running) => {
    if (!running)
    {
        console.log(`Gateway is not running on '${baseUri}'`);
        process.exit(1);
    }
    return restClient.deleteSession(sessionId).then((data) => {
        console.log(`Session '${sessionId}' successfully deleted :`);
        console.log(Helpers.stringify(data) + "\n");
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
