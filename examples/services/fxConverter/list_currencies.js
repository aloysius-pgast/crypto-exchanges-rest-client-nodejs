"use strict";

/*
This example show how list fiat currencies supported by fxConverter module
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

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
    return restClient.getServices().then((services) => {
        // ensure service is supported
        if (!restClient.checkService(services, 'fxConverter'))
        {
            console.log(`fxConverter service is not enabled on gateway`);
            process.exit(1);
        }
        return restClient.listFxConverterCurrencies().then((data) => {
            console.log(`Currencies supported by fxConverter module :`);
            console.log(Helpers.stringify(data, null, 4) + "\n");
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
