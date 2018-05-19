"use strict";

/*
This example show how to retrieve open orders for a list of pairs
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = [
    {exchange:'binance',pairs:['USDT-NEO','BTC-GAS']},
    {exchange:'bittrex',pairs:['USDT-NEO']}
]

// first ensure gateway is running
restClient.ping().then((running) => {
    if (!running)
    {
        console.log(`Gateway is not running on '${baseUri}'`);
        process.exit(1);
    }
    // retrieve services to ensure exchanges are supported
    return restClient.getServices().then((services) => {
        // build promise list
        let arr = [];
        _.forEach(opt, (e) => {
            // ignore exchange if it's not supported, just use a promise which return null
            if (!restClient.checkExchange(services, e.exchange, ['openOrders']))
            {
                arr.push(Promise.resolve(null));
                return;
            }
            arr.push(restClient.getOpenOrders(e.exchange, {pairs:e.pairs}));
        });
        return Promise.all(arr).then((results) => {
            _.forEach(results, (data, index) => {
                if (null === data)
                {
                    console.log(`No data for '${opt[index].exchange}' (exchange is probably not supported)\n`);
                    return;
                }
                let exchange = opt[index].exchange;
                // in case no valid credentials have been configured on gateway, exchange is probably in demo mode (ie: using fake orders)
                if (restClient.isDemoExchange(services, exchange))
                {
                    exchange = `${exchange} (demo)`;
                }
                console.log(`Found ${Object.keys(data).length} open orders for '${exchange}' (will only display 3 randomly) :`);
                let result = Helpers.getSample(data, 3);
                console.log(Helpers.stringify(result) + "\n");
            });
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
