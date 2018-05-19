"use strict";

/*
This example show how to test an order to ensure it matches exchange filters (ie: min quantity or min price)
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

/*
 At least one of the following properties should be defined :
 - quantity : quantity to buy/sell
 - targetPrice : quantity * targetRate (quantity will be computed automatically)
 - finalPrice : (quantity * targetRate) +- fees (quantity will be computed automatically)
*/
const opt = [
    {
        exchange:'binance',
        pair:'USDT-NEO',
        orderType:'buy',
        targetRate:0.5,
        // quantity is not enough and will be updated in the result returned by gateway
        quantity:0.00001
    },
    {
        exchange:'bittrex',
        pair:'USDT-BTC',
        orderType:'sell',
        targetRate:20000,
        // we indicate we want to have a final amount of 5000 USDT after substracting fees
        finalPrice:5000
    }
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
            if (!restClient.checkExchange(services, e.exchange))
            {
                arr.push(Promise.resolve(null));
                return;
            }
            let orderOpt = {
                quantity:e.quantity,
                targetPrice:e.targetPrice,
                finalPrice:e.finalPrice
            };
            arr.push(restClient.testOrder(e.exchange, e.pair, e.orderType, e.targetRate, orderOpt));
        });
        return Promise.all(arr).then((results) => {
            _.forEach(results, (data, index) => {
                if (null === data)
                {
                    console.log(`No data for '${opt[index].exchange}' (exchange is probably not supported)\n`);
                    return;
                }
                console.log(`Updated order definition for '${opt[index].pair}' on '${opt[index].exchange}' :`);
                console.log(Helpers.stringify(data) + "\n");
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
