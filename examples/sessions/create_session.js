"use strict";

/*
This example show how to list existing RPC sessions which can be re-used to connect over websocket
*/
const _ = require('lodash');
const Helpers = require('../lib/helpers');
const Client = require('../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const sessionId = 'mySession';
// gateway will subscribe to tickers, orderBooks & trades for all pairs listed below
let opt = [
    {exchange:'binance',pairs:['USDT-NEO','BTC-GAS']},
    {exchange:'bittrex',pairs:['USDT-BTC']}
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
            // ignore exchange if it's not supported
            if (!restClient.checkExchange(services, e.exchange, ['wsTickers', 'wsOrderBooks', 'wsTrades']))
            {
                arr.push(Promise.resolve(null));
                return;
            }
            _.forEach(e.pairs, (pair) => {
                arr.push(restClient.addTickersSubscription(sessionId, e.exchange, pair));
                arr.push(restClient.addOrderBookSubscription(sessionId, e.exchange, pair));
                arr.push(restClient.addTradesSubscription(sessionId, e.exchange, pair));
            });
        });
        return Promise.all(arr).then((results) => {
            let wsUri = `${Helpers.getWsUri(baseUri)}/?sid=${sessionId}`;
            console.log(`Session '${sessionId}' successfully created. You can connect to '${wsUri}' to get real-time data\n`);
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
