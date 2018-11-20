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

/*
  Get rates for following conversions :
  - value of 1 EUR in USD
  - value of 1 USD in EUR
  - value of 1 GBP in EUR
*/
let opt = {
    pairs:['USD-EUR','EUR-USD', 'EUR-GBP']
}

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
        return restClient.getFxConverterRates(opt.pairs).then((data) => {
            console.log(`Rates :`);
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
