"use strict";

//-- DISCLAIMER : read the code carefully before running it

/*
This example show how to build a simple bot which will do the following :

- wait until price of a given pair falls below maxRate
- trigger a buy order at the last trades price
- wait for order to be fulfilled
- trigger a sell order with a +profitPercent

NB: if order creation fails, the bot will abort

*/
const _ = require('lodash');
const Helpers = require('../lib/helpers');
const Client = require('../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

const opt = {
    // the exchange we want to use the bot with
    exchange:'binance',
    // the pair we want to monitor
    pair:'BTC-GAS',
    // if last price falls below this value, trigger a buy
    maxRate:0.001,
    // the quantity to buy
    quantity:0.35,
    // profit [0-100]
    profitPercent:5,
    // check tickers every 60s
    tickersCheckDelay:60,
    // once buy order has been placed, check order every 60s
    orderCheckDelay:60
}

/**
 * Used to wait for an amount of seconds
 *
 * @return {integer} delay number of seconds to wait
 */
const wait = function(delay){
    return new Promise((resolve, reject) => {
        setTimeout(function(){
            return resolve();
        }, delay * 1000);
    });
}

/**
 * Log message with timestamp
 */
const logMessage = function(message) {
    let timestamp = new Date().toLocaleString();
    console.log(`${timestamp} - ${message}`);
}

/**
 * Used to check tickers for the pair we're interested in and return only once price matches
 *
 * @return {float} last price
 */
const checkTickers = async () => {
    let iter = 0;
    while (true)
    {
        ++iter;
        let delay = opt.tickersCheckDelay;
        // check tickers directly on first iteration
        if (1 == iter)
        {
            delay = 0;
        }
        await wait(delay);
        let tickers;
        try
        {
            tickers = await restClient.getTickers(opt.exchange, [opt.pair]);
        }
        catch (e)
        {
            logMessage('Could not check tickers, will try again on next iteration');
            console.log(JSON.stringify(e));
            continue;
        }
        if (undefined === tickers[opt.pair])
        {
            logMessage(`Ticker for pair '${opt.pair}' does not exist, will try again on next iteration`);
            continue;
        }
        if (tickers[opt.pair].last < opt.maxRate)
        {
            logMessage(`Ticker for pair '${opt.pair}' is < ${opt.maxRate} (${tickers[opt.pair].last}). Time to buy !`);
            return tickers[opt.pair].last;
            continue;
        }
        logMessage(`Ticker for pair '${opt.pair}' is >= ${opt.maxRate} (${tickers[opt.pair].last}). Will check again on next iteration`);
        continue;
    }
}

/**
 * Function which will create a buy order at a given rate
 */
const createBuyOrder = async (rate) => {
    let data;
    try
    {
        data = await restClient.createOrder(opt.exchange, opt.pair, 'buy', rate, opt.quantity);
    }
    catch (e)
    {
        logMessage(`Could not create buy order. Aborting !`);
        console.log(JSON.stringify(e));
        return null;
    }
    logMessage(`Successfully created buy order '${data.orderNumber}' (rate = ${rate})`);
    return data.orderNumber;
}

/**
 * Function which will create a sell order
 */
const createSellOrder = async (quantity, rate) => {
    // first ensure we will match exchange filters
    let testOrder;
    try
    {
        testOrder = await restClient.testOrder(opt.exchange, opt.pair, 'sell', rate, {quantity:quantity});
    }
    catch (e)
    {
        logMessage(`Could not test order. Aborting !`);
        console.log(JSON.stringify(e));
        return null;
    }
    let data;
    try
    {
        data = await restClient.createOrder(opt.exchange, opt.pair, 'sell', testOrder.targetRate, quantity);
    }
    catch (e)
    {
        logMessage(`Could not create sell order. Aborting !`);
        console.log(JSON.stringify(e));
        return null;
    }
    logMessage(`Successfully created sell order '${data.orderNumber}' (quantity = ${quantity}, rate = ${testOrder.targetRate})`);
    return data.orderNumber;
}

/**
 * Function which will monitor an order and return once order has been closed
 *
 * @return {object} order object
 */
const monitorOrder = async (orderNumber) => {
    let iter = 0;
    while (true)
    {
        ++iter;
        let delay = opt.orderCheckDelay;
        // check tickers directly on first iteration
        if (1 == iter)
        {
            delay = 0;
        }
        await wait(delay);
        let order;
        try
        {
            order = await restClient.getOrder(opt.exchange, orderNumber, opt.pair);
        }
        catch (e)
        {
            logMessage(`Could not retrieve order '${orderNumber}', will try again on next iteration`);
            console.log(JSON.stringify(e));
            continue;
        }
        // order is still open
        if (undefined !== order.remainingQuantity)
        {
            logMessage(`Order '${orderNumber}' is still open. Will check again on next iteration`);
            continue;
        }
        // order has been cancelled before being partially filled (ie: quantity = 0)
        let quantity = order.quantity;
        if (0 == quantity)
        {
            logMessage(`Order '${orderNumber}' has been cancelled before being filled. Aborting !`);
            return null;
        }
        logMessage(`Order '${orderNumber}' has been filled (quantity = ${quantity}). Time to sell !`);
        return order;
    }
}

/**
 * Function will do the following
 * - check tickers
 * - trigger buy order
 * - wait for buy order to be fulfilled
 * - trigger sell order
 */
const main = async function(){
    let lastPrice = await checkTickers();
    let buyOrderNumber = await createBuyOrder(lastPrice);
    // order creation failed
    if (null === buyOrderNumber)
    {
        return;
    }
    let order = await monitorOrder(buyOrderNumber);
    // order was cancelled
    if (null === order)
    {
        return;
    }
    // sell the same quantity as in previous order
    let quantity = order.quantity;
    let rate = order.finalRate + (order.finalRate * opt.profitPercent / 100.0);
    let sellOrderNumber = await createSellOrder(quantity, rate);
    // order creation failed
    if (null === sellOrderNumber)
    {
        return;
    }
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
        if (!restClient.checkExchange(services, opt.exchange, ['tickers','orders','order']))
        {
            console.log(`Exchange '${opt.exchange}' is not enabled on gateway`);
            process.exit(1);
        }
        return main();
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
