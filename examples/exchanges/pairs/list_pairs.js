"use strict";

/*
This example show how to list pairs on exchanges
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = [
    {exchange:'binance'},
    {exchange:'bittrex'}
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
            if (!restClient.checkExchange(services, e.exchange, ['pairs']))
            {
                arr.push(Promise.resolve(null));
                return;
            }
            arr.push(restClient.getPairs(e.exchange));
        });
        return Promise.all(arr).then((results) => {
            _.forEach(results, (data, index) => {
                if (null === data)
                {
                    console.log(`No data for '${opt[index].exchange}' (exchange is probably not supported)\n`);
                    return;
                }
                console.log(`Found ${Object.keys(data).length} pairs on '${opt[index].exchange}' (will only display 3 randomly)`);
                // display 3 random pairs
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
