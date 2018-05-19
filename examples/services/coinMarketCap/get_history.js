"use strict";

/*
This example show how to retrieve history from CoinMarketCap
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

// retrieve history for NEO between 2017-12-25 & 2017-12-31
let opt = {
    symbol:'NEO',
    from:'2017-12-25',
    to:'2017-12-31'
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
        if (!restClient.checkService(services, 'coinmarketcap', ['history']))
        {
            console.log(`CoinMarketCap history is not enabled on gateway`);
            process.exit(1);
        }
        return restClient.getCoinMarketCapHistory(opt.symbol, {from:opt.from, to:opt.to}).then((data) => {
            console.log(`History :`);
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
