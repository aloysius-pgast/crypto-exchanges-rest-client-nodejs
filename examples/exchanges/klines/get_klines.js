"use strict";

/*
This example show how to retrieve klines (chart data)
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = [
    {exchange:'binance',pair:'USDT-NEO',interval:'5m'},
    {exchange:'bittrex',pair:'USDT-BTC',interval:'5m'}
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
            if (!restClient.checkExchange(services, e.exchange, ['klines']))
            {
                arr.push(Promise.resolve(null));
                return;
            }
            arr.push(restClient.getKlines(e.exchange, e.pair, {interval:e.interval}));
        });
        return Promise.all(arr).then((results) => {
            _.forEach(results, (data, index) => {
                if (null === data)
                {
                    console.log(`No data for '${opt[index].exchange}' (exchange is probably not supported)\n`);
                    return;
                }
                console.log(`Klines for '${opt[index].pair}' on '${opt[index].exchange}' (will only display a sample) :`);
                let result = Helpers.describeArray(data, 3);
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
