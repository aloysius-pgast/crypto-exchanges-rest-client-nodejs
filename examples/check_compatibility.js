"use strict";

/*
Checks whether or not client version is compatible with gateway version
*/
const _ = require('lodash');
const Helpers = require('./lib/helpers');
const Client = require('../lib/client');

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
    // retrieve services to ensure exchanges are supported
    return restClient.isCompatible().then((isCompatible) => {
        if (isCompatible)
        {
            console.log('Client is compatible with gateway');
            return;
        }
        console.log('Client is not compatible with gateway');
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
