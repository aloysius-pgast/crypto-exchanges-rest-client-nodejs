"use strict";

/*
This example show how to retrieve a single order (open or closed)
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = {
    exchange:'binance',
    pair:'USDT-NEO',
    orderType:'sell',
    targetRate:5000,
    quantity:0.01
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
        // ensure exchange is supported
        if (!restClient.checkExchange(services, opt.exchange, ['order']))
        {
            console.log(`Exchange '${opt.exchange}' is not enabled on gateway`);
            process.exit(1);
        }
        return restClient.createOrder(opt.exchange, opt.pair, opt.orderType, opt.targetRate, opt.quantity).then((data) => {
            console.log(`Order successfully created on '${opt.exchange}' :`);
            console.log(Helpers.stringify(data) + "\n");
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
