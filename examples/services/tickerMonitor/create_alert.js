"use strict";

/*
This example show how to create a new tickerMonitor alert
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

/* Creates an alert if USDT-NEO last price on binance exchange is in range [130,141] AND NEO price on CoinMarketCap is > 130 */

let opt = {
    name:'MyAlert',
    // id of the exchange we want to define alert for
    exchange:'binance',
    // condition will become active if price moves into this range
    exchangeRange:[70,85],
    // condition will become active is price on CoinMarketCap becomes greater then this price
    coinMarketCapPrice:70
}
let conditionBuilder = restClient.getTickerMonitorConditionBuilder();
conditionBuilder.exchange(opt.exchange, 'USDT-NEO', 'last', 'in', opt.exchangeRange).coinMarketCap('NEO', 'price_usd', 'gt', opt.coinMarketCapPrice);

// first ensure gateway is running
restClient.ping().then((running) => {
    if (!running)
    {
        console.log(`Gateway is not running on '${baseUri}'`);
        process.exit(1);
    }
    // retrieve services to ensure service is supported
    return restClient.getServices().then((services) => {
        // ensure service is supported
        if (!restClient.checkService(services, 'tickerMonitor'))
        {
            console.log(`Service 'tickerMonitor' is not enabled on gateway`);
            process.exit(1);
        }
        // ensure exchange is supported
        if (!restClient.checkExchange(services, opt.exchange))
        {
            console.log(`Exchange '${opt.exchange}' is not enabled on gateway`);
            process.exit(1);
        }
        return restClient.createTickerMonitorAlert(opt.name, conditionBuilder).then((data) => {
            console.log(`Alert '${opt.name}' successfully created :`);
            console.log(Helpers.stringify(data) + "\n");
            let wsUri = `${Helpers.getWsUri(baseUri)}/tickerMonitor`;
            console.log(`You can connect to '${wsUri}' to get real-time notification regarding alert status\n`);
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
