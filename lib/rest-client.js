"use strict";
const debug = require('debug')('CERC:Client');
const _ = require('lodash');
const request = require('request');
const TickerMonitorConditionBuilder = require('./ticker-monitor-condition-builder');
const Errors = require('./errors');

const DEFAULT_SOCKETTIMEOUT = 300 * 1000;
const DEFAULT_BASE_URI = 'http://127.0.0.1:8000';
// minimum gateway version
const MIN_VERSION = '1.6.0';

/**
 * Promise reflector
 */
const reflect = (descriptor, opt) => {
    return descriptor.promise.then(function(data){
        return {success:true, value:data, context:descriptor.context};
    }).catch(function(err){
        if (!opt.stopOnError)
        {
            return {success:false, value:err, context:descriptor.context};
        }
        throw err;
    });
};

/**
 * Each array entry can be either a Promise object or an object {promise:Promise, context:{}}
 * opt.stopOnError : stop after one error (like default Promise.all behaviour)
 */
const allPromises = (arr, opt) => {
    let _opt = {stopOnError:false};
    if (undefined !== opt)
    {
        if (undefined !== opt.stopOnError)
        {
            _opt.stopOnError = opt.stopOnError;
        }
    }
    return Promise.all(arr.map(function(entry) {
        // probably a promise
        if ('function' == typeof entry.then)
        {
            entry = {promise:entry, context:{}};
        }
        else if (undefined === entry.context)
        {
            entry.context = {};
        }
        return reflect(entry, _opt);
    }));
}

class Client
{

/**
 * @param {string} opt.baseUri base uri starting with http|https (optional, default = http://127.0.0.1:8000)
 * @param {integer} opt.timeout timeout in seconds to wait for gateway to send response headers (optional, default = 300)
 * @param {string} opt.apiKey api key defined on gateway
 */
constructor(opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    this._baseUri = DEFAULT_BASE_URI;
    this._timeout = DEFAULT_SOCKETTIMEOUT;
    this._apiKey = '';

    if (undefined !== opt.baseUri)
    {
        if (!opt.baseUri.startsWith('http://') && !opt.baseUri.startsWith('https://'))
        {
            throw new Errors.ClientError.InvalidRequest.InvalidParameter('opt.baseUri', opt.baseUri, "Parameter 'opt.baseUri' should start with 'http://' or 'https://'");
        }
        this._baseUri = opt.baseUri;
    }
    if (undefined !== opt.apiKey && '' != opt.apiKey)
    {
        this._apiKey = opt.apiKey;
    }
    if (undefined !== opt.timeout)
    {
        this._timeout = value;
    }
}

/**
 * Builds an url from a path
 */
_getUrl(path)
{
    return `${this._baseUri}/${path}`
}

/**
 * Builds an url from an exchange identifier & a path
 */
_getExchangeUrl(exchangeId, path)
{
    return `${this._baseUri}/exchanges/${exchangeId}/${path}`
}

/**
 * Performs the request (internal use)
 * @param {string} method http method
 * @param {string} url to call
 * @param {object} params request query parameters
 * @param {boolean} json whether or not we should send a json body
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
_makeRequest(method, url, params, jsonBody)
{
    if (undefined === jsonBody)
    {
        jsonBody = false;
    }
    let opt = {
        json:true,
        timeout:this._timeout,
        method:method.toUpperCase(),
        url:url
    };
    if (undefined !== params)
    {
        if (jsonBody)
        {
            opt.body = params;
        }
        else
        {
            opt.qs = params;
            opt.useQuerystring = true;
        }
    }
    if ('' !== this._apiKey)
    {
        opt.headers = {
            'ApiKey':this._apiKey
        }
    }
    if (debug.enabled)
    {
        debug(`REQ: ${method} ${url} ${JSON.stringify(params || {})}`);
    }
    return new Promise((resolve, reject) => {
        request(opt, function (error, response, body) {
            // client error
            if (null !== error)
            {
                let err;
                if ('ETIMEDOUT' == error.code)
                {
                    err = new Errors.ClientError.NetworkError.RequestTimeout(error.message);
                }
                else
                {
                    err = new Errors.ClientError.NetworkError.UnknownError(error.message);
                }
                if (debug.enabled)
                {
                    debug(`ERR: ${JSON.stringify(err)}`);
                }
                return reject(err);
            }
            if (undefined !== body.extError)
            {
                let err = new Errors.RemoteError(response.statusCode, body);
                if (debug.enabled)
                {
                    debug(`ERR: ${JSON.stringify(err)}`);
                }
                return reject(err);
            }
            if (debug.enabled)
            {
                debug(`RES: ${JSON.stringify(body)}`);
            }
            return resolve(body);
        });
    });
}

/**
 * Sends a custom request to the gateway
 *
 * @param {string} path request path
 * @param {string} opt.method http method (optional, default = GET)
 * @param {object} opt.params request parameters (optional)
 * @param {boolean} opt.jsonBody whether or not JSON body should be used to send parameters (optional, default = false)
 */
customRequest(path, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    if (undefined === opt.method)
    {
        opt.method = 'GET';
    }
    let _path = path;
    if ('/' == _path.substr(0, 1))
    {
        _path = _path.substr(1);
    }
    let url = this._getUrl(_path);
    return this._makeRequest(opt.method, url, opt.params, opt.jsonBody);
}

/**
 * Check if gateway is available
 *
 * @return {Promise} Promise which will resolve to true if gateway is available, false otherwise
 */
async ping()
{
    try
    {
        let data = await this.getUptime();
        return true;
    }
    catch (e)
    {
        return false;
    }
}

/**
 * Checks whether or not an error if a BaseError
 *
 * @param {object} err BaseError object
 * @return {boolean}
 */
isBaseError(err)
{
    return err instanceof Errors.BaseError;
}

/**
 * Checks whether or not an error is a client error
 *
 * @param {object} err BaseError object
 * @return {boolean}
 */
isClientError(err)
{
    return err instanceof Errors.ClientError;
}

/**
 * Checks whether or not an error is a remote error (ie: returned by gateway)
 *
 * @param {object} err BaseError object
 * @return {boolean}
 */
isRemoteError(err)
{
    return err instanceof Errors.RemoteError;
}

/**
 * Checks whether or not an error is of a given type (ex: ExchangeError.InvalidRequest)
 *
 * @param {object} err BaseError object
 * @param {string} errorType (ex: ExchangeError.InvalidRequest)
 */
isErrorType(err, errorType)
{
    if (!err instanceof Errors.BaseError)
    {
        return false;
    }
    return err.instanceOf(errorType);
}

/**
 * Returns uptime & version
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getUptime()
{
    let url = this._getUrl('server/uptime');
    return this._makeRequest('GET', url);
}

/**
 * Check compatibility
 * @return {Promise} Promise which will resolve to true|false or reject a BaseError exception
 */
async isCompatible()
{
    let url = this._getUrl('server/uptime');
    let data = await this._makeRequest('GET', url);
    let minVersion = _.map(MIN_VERSION.split('.'), (e) => {return parseInt(e)});
    if (undefined === data.version)
    {
        return false;
    }
    let remoteVersion = _.map(data.version.split('.'), (e) => {return parseInt(e)});
    if (minVersion.length < remoteVersion.length)
    {
        for (let i = minVersion.length; i < remoteVersion.length; ++i)
        {
            minVersion.push(0);
        }
    }
    else if (remoteVersion.length < minVersion.length)
    {
        for (let i = remoteVersion.length; i < minVersion.length; ++i)
        {
            remoteVersion.push(0);
        }
    }
    for (let i = 0; i < minVersion.length; ++i)
    {
        if (remoteVersion[i] < minVersion[i])
        {
            return false;
        }
    }
    return true;
}


/**
 * Returns all services supported by gateway
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getServices()
{
    let url = this._getUrl('server/services');
    return this._makeRequest('GET', url);
}

/**
 * Checks whether or not an exchange is supported
 *
 * @param {object} services object returned by 'getServices'
 * @param {string} exchangeId exchange identifier
 * @param {string|string[]} features exchange features which needs to be enabled (optional)
 * @return {boolean} true if exchange and all features are supported, false otherwise
 */
checkExchange(services, exchangeId, features)
{
    if (undefined === services)
    {
        return false;
    }
    if (undefined === services.exchanges[exchangeId])
    {
        return false;
    }
    if (undefined === features)
    {
        return true;
    }
    let featuresList = features;
    if (!Array.isArray(featuresList))
    {
        featuresList = [features];
    }
    let supported = true;
    _.forEach(featuresList, (f) => {
        // at least one feature is not enabled
        if (undefined === services.exchanges[exchangeId].features[f] || !services.exchanges[exchangeId].features[f].enabled)
        {
            supported = false;
            return false;
        }
    });
    return true;
}

/**
 * Whether or not an exchange is running in demo mode
 *
 * @param {object} services object returned by 'getServices'
 * @param {string} exchangeId exchange identifier
 * @return {boolean} true if exchange is running in demo mode
 */
isDemoExchange(services, exchangeId)
{
    if (undefined === services)
    {
        return false;
    }
    if (undefined === services.exchanges[exchangeId])
    {
        return false;
    }
    return true === services.exchanges[exchangeId].demo;
}

/**
 * Checks whether or not a service is supported
 *
 * @param {object} services object returned by 'getServices'
 * @param {string} serviceId service identifier
 * @param {string|string[]} features service features which needs to be enabled (optional)
 * @return {boolean} true if service and all features are supported, false otherwise
 */
checkService(services, serviceId, features)
{
    if (undefined === services)
    {
        return false;
    }
    if (undefined === services.others[serviceId])
    {
        return false;
    }
    if (undefined === features)
    {
        return true;
    }
    let featuresList = features;
    if (!Array.isArray(featuresList))
    {
        featuresList = [features];
    }
    let supported = true;
    _.forEach(featuresList, (f) => {
        // at least one feature is not enabled
        if (undefined === services.others[serviceId].features[f] || !services.others[serviceId].features[f].enabled)
        {
            supported = false;
            return false;
        }
    });
    return true;
}

/**
 * Whether or not an exchange is running in demo mode
 *
 * @param {object} services object returned by 'getServices'
 * @param {string} serviceId service identifier
 * @return {boolean} true if service is running in demo mode
 */
isDemoService(services, serviceId)
{
    if (undefined === services)
    {
        return false;
    }
    if (undefined === services.others[serviceId])
    {
        return false;
    }
    return true === services.others[serviceId].demo;
}

/**
 * List all exchanges enabled on the gateway
 *
 * @param {string} opt.pair used to list only the exchanges supporting a given pair (optional)
 * @param {string} opt.currency used to list only pairs having a given currency (optional, will be ignored if opt.pair is set)
 * @param {string} opt.baseCurrency used to list only pairs having a given base currency (optional, will be ignored if opt.pair or opt.currency are defined)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getExchanges(opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let url = this._getUrl('exchanges')
    let params = {};
    if (undefined !== opt.pair && '' != opt.pair)
    {
        params.pair = opt.pair;
    }
    else if (undefined !== opt.currency && '' != opt.currency)
    {
        params.currency = opt.currency;
    }
    else if (undefined !== opt.baseCurrency && '' != opt.baseCurrency)
    {
        params.baseCurrency = opt.baseCurrency;
    }
    return this._makeRequest('GET', url, params);
}

//-- pairs

/**
 * List available pairs for a given exchange
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} opt.currency used to list only pairs having a given currency (optional)
 * @param {string} opt.baseCurrency used to list only pairs having a given base currency (optional, will be ignored if opt.currency is defined)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getPairs(exchangeId, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.currency && '' != opt.currency)
    {
        params.currency = opt.currency;
    }
    else if (undefined !== opt.baseCurrency && '' != opt.baseCurrency)
    {
        params.baseCurrency = opt.baseCurrency;
    }
    let url = this._getExchangeUrl(exchangeId, 'pairs')
    return this._makeRequest('GET', url, params);
}

/**
 * Search for pairs across based on a base currency or a currency
 *
 * @param {string} search currency/base currency to search (optional)
 * @param {string} type (currency|baseCurrency) (default = currency) (will be ignored if search is not set)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
findPairs(search, type)
{
    let opt = {};
    if (undefined !== search && '' != search)
    {
        // by default, search for currency
        if (undefined === type)
        {
            type = 'currency';
        }
        switch (type)
        {
            case 'currency':
                opt.currency = search;
                break;
            case 'baseCurrency':
                opt.baseCurrency = search;
                break;
        }
    }
    let self = this;
    return new Promise((resolve, reject) => {
        self.getExchanges(opt).then(function(exchanges){
            let list = [];
            let promises = [];
            for (var i = 0; i < exchanges.length; ++i)
            {
                let p = self.getPairs(exchanges[i], opt);
                promises.push({promise:p, context:{exchange:exchanges[i]}});
            }
            allPromises(promises).then(function(data){
                _.forEach(data, function (entry) {
                    // could not retrieve pairs for this exchange
                    if (!entry.success)
                    {
                        return;
                    }
                    _.forEach(entry.value, (obj) => {
                        list.push({exchange:entry.context.exchange,pair:obj.pair,currency:obj.currency,baseCurrency:obj.baseCurrency});
                    });
                });
                return resolve(list);
            });
        }).catch (function(err){
            return reject(err);
        });
    });
}

// -- tickers

/**
 * Retrieves tickers
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {array} pairs array of pairs (optional, tickers for all pairs will be retrieved if not set)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getTickers(exchangeId, pairs)
{
    let params = {};
    if (undefined !== pairs && 0 !== pairs.length)
    {
        params.pairs = pairs;
    }
    let url = this._getExchangeUrl(exchangeId, 'tickers')
    return this._makeRequest('GET', url, params);
}

//-- order books

/**
 * Retrieves order book for a given pair
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} pair pair to retrieve order book for
 * @param {integer} limit how many entries to retrieve (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getOrderBook(exchangeId, pair, limit)
{
    let params = {};
    if (undefined !== limit)
    {
        params.limit = limit;
    }
    let url = this._getExchangeUrl(exchangeId, `orderBooks/${pair}`)
    return this._makeRequest('GET', url, params);
}

//-- trades

/**
 * Retrieves trades for a given pair
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} pair pair to retrieve trades for
 * @param {integer} opt.afterTradeId only retrieve trades with an id > opt.afterTradeId
 * @param {integer} opt.afterTimestamp only retrieve trades with an timestamp > opt.afterTimestamp
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getTrades(exchangeId, pair, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.afterTradeId)
    {
        params.afterTradeId = opt.afterTradeId;
    }
    if (undefined !== opt.afterTimestamp)
    {
        params.afterTimestamp = opt.afterTimestamp;
    }
    let url = this._getExchangeUrl(exchangeId, `trades/${pair}`)
    return this._makeRequest('GET', url, params);
}

//-- klines

/**
 * Retrieves chart data for a given pair
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} pair pair to retrieve trades for
 * @param {string} opt.interval (optional, default = 5m)
 * @param {float} opt.fromTimestamp only retrieve klines with timestamp >= 'opt.fromTimestamp' (optional)
 * @param {integer} opt.toTimestamp toTimestamp only retrieve klines with timestamp <= 'opt.toTimestamp' (optional, will be ignored if 'opt.fromTimestamp' is not defined) (if not set will return first 500 entries from 'opt.fromTimestamp')
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getKlines(exchangeId, pair, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.interval)
    {
        params.interval = opt.interval;
    }
    if (undefined !== opt.fromTimestamp)
    {
        params.fromTimestamp = opt.fromTimestamp;
        if (undefined !== opt.toTimestamp)
        {
            params.toTimestamp = opt.toTimestamp;
        }
    }
    let url = this._getExchangeUrl(exchangeId, `klines/${pair}`)
    return this._makeRequest('GET', url, params);
}

// -- orders

/**
 * Retrieves open orders
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {array} opt.pairs array of pairs (optional, open orders for all pairs will be retrieved if not set)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getOpenOrders(exchangeId, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.pairs && 0 !== opt.pairs.length)
    {
        params.pairs = opt.pairs;
    }
    let url = this._getExchangeUrl(exchangeId, 'openOrders')
    return this._makeRequest('GET', url, params);
}

/**
 * Retrieves a single open order
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} orderNumber order number
 * @param {string} opt.pair order pair (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getOpenOrder(exchangeId, orderNumber, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {orderNumber:orderNumber};
    if (undefined !== opt.pair)
    {
        params.pair = opt.pair;
    }
    let url = this._getExchangeUrl(exchangeId, `openOrders/${orderNumber}`)
    return this._makeRequest('GET', url, params);
}

/**
 * Retrieves closed orders
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {array} opt.pairs array of pairs (optional, closed orders for all pairs will be retrieved if not set)
 * @param {boolean} opt.completeHistory indicates full history should be retrieved (might no be supported on all exchanges) (optional, default = false)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getClosedOrders(exchangeId, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {completeHistory:false};
    if (undefined !== opt.pairs && 0 !== opt.pairs.length)
    {
        params.pairs = opt.pairs;
    }
    if (true === opt.completeHistory)
    {
        params.completeHistory = true;
    }
    let url = this._getExchangeUrl(exchangeId, 'closedOrders')
    return this._makeRequest('GET', url, params);
}

/**
 * Retrieves a single closed order
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} orderNumber order number of the order to retrieve
 * @param {string} opt.pair order pair (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getClosedOrder(exchangeId, orderNumber, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {orderNumber:orderNumber};
    if (undefined !== opt.pair)
    {
        params.pair = opt.pair;
    }
    let url = this._getExchangeUrl(exchangeId, `closedOrders/${orderNumber}`)
    return this._makeRequest('GET', url, params);
}

/**
 * Creates a new order
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} pair (ex: USDT-BTC)
 * @param {string} orderType order type (buy|sell)
 * @param {float} targetRate buy/sell price
 * @param {float} quantity quantity to buy/sell
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
createOrder(exchangeId, pair, orderType, targetRate, quantity)
{
    let params = {pair:pair, orderType:orderType, quantity:quantity, targetRate:targetRate};
    let url = this._getExchangeUrl(exchangeId, 'openOrders');
    return this._makeRequest('POST', url, params);
}

/**
 * Cancels an order
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} orderNumber number of the order to cancel
 * @param {string} pair order pair (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
cancelOrder(exchangeId, orderNumber, pair)
{
    let params = {};
    if (undefined !== pair)
    {
        params.pair = pair;
    }
    let url = this._getExchangeUrl(exchangeId, `openOrders/${orderNumber}`)
    return this._makeRequest('DELETE', url, params);
}

/**
 * Retrieves an order (open or closed)
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} orderNumber number of the order to retrieve
 * @param {string} pair order pair (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getOrder(exchangeId, orderNumber, pair)
{
    let params = {};
    if (undefined !== pair)
    {
        params.pair = pair;
    }
    let url = this._getExchangeUrl(exchangeId, `orders/${orderNumber}`)
    return this._makeRequest('GET', url, params);
}

/**
 * Test an order to ensure it will match exchange filters (such as min quantity, min price ...)
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} pair (ex: USDT-BTC)
 * @param {string} orderType order type (buy|sell)
 * @param {float} targetRate buy/sell price
 * @param {float} opt.quantity (optional)
 * @param {float} opt.targetPrice targetRate * opt.quantity (optional, will be ignored if opt.quantity is defined)
 * @param {float} opt.finalPrice (targetRate * opt.quantity) +- fees (optional, will be ignored if opt.quantity or opt.targetPrice is defined)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
testOrder(exchangeId, pair, orderType, targetRate, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {pair:pair, orderType:orderType, targetRate:targetRate};
    if (undefined !== opt.quantity)
    {
        params.quantity = opt.quantity;
    }
    if (undefined !== opt.targetPrice)
    {
        params.targetPrice = opt.targetPrice;
    }
    if (undefined !== opt.finalPrice)
    {
        params.finalPrice = opt.finalPrice;
    }
    let url = this._getExchangeUrl(exchangeId, `testOrder`)
    return this._makeRequest('GET', url, params);
}

//-- balances

/**
 * Retrieves balances for all currencies with a balance > 0 (ie: amount(available) + amount(on orders) must be > 0)
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getBalances(exchangeId)
{
    let url = this._getExchangeUrl(exchangeId, 'balances')
    return this._makeRequest('GET', url);
}

/**
 * Retrieves balance for a single currency. Currency will be ignored if balance is <= 0 (ie: amount(available) + amount(on orders) must be > 0)
 *
 * @param {string} exchangeId exchange identifier (ex: bittrex)
 * @param {string} currency currency to retrieve balance for (ex: BTC)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getBalance(exchangeId, currency)
{
    let url = this._getExchangeUrl(exchangeId, `balances/${currency}`)
    return this._makeRequest('GET', url);
}

//-- CoinMarketCap

/**
 * Retrieves CoinMarketCap tickers
 *
 * @param {array} opt.symbols array of symbols (ex: ['BTC','ETH']) (optional)
 * @param {integer} opt.limit limit result size (optional, default = 100) (will be ignored if opt.symbols is set)
 * @param {string[]} opt.convertTo convert tickers value to another currency/symbol (ex: GBP or ETH) (optional)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getCoinMarketCapTickers(opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.symbols)
    {
        params.symbols = opt.symbols;
    }
    if (undefined !== opt.limit)
    {
        params.limit = opt.limit;
    }
    if (undefined !== opt.convertTo)
    {
        params.convertTo = opt.convertTo;
    }
    let url = this._getUrl('coinmarketcap/tickers')
    return this._makeRequest('GET', url, params);
}

/**
 * Retrieves CoinMarketCap history for a given symbol
 *
 * @param {string} symbol symbol to retrieve history for (ex: 'BTC')
 * @param {boolean} opt.completeHistory if true complete history will be retrieved for this symbol (optional, default = false)
 * @param {string} opt.from start date (yyyy-mm-dd) (optional, will be ignored if opt.completeHistory is true)
 * @param {string} opt.to end date (yyyy-mm-dd) (optional, will be ignored if opt.completeHistory is true)
 * @param {string} opt.sort (asc|desc) if 'desc', newest will be first
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getCoinMarketCapHistory(symbol, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.completeHistory)
    {
        params.completeHistory = opt.completeHistory;
    }
    if (undefined !== opt.from)
    {
        params.from = opt.from;
    }
    if (undefined !== opt.to)
    {
        params.to = opt.to;
    }
    if (undefined !== opt.sort)
    {
        params.sort = opt.sort;
    }
    let url = this._getUrl(`coinmarketcap/history/${symbol}`)
    return this._makeRequest('GET', url, params);
}

/**
 * Returns all existing symbols
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getCoinMarketCapSymbols()
{
    let url = this._getUrl('coinmarketcap/symbols')
    return this._makeRequest('GET', url);
}

/**
 * Returns all existing fiat currencies
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getCoinMarketCapFiatCurrencies()
{
    let url = this._getUrl('coinmarketcap/fiatCurrencies');
    return this._makeRequest('GET', url);
}

//-- PushOver

/**
* Sends a push notification using PushOver
*
* @param {string} message message to send
* @param {string} opt.format message format html|text (optional, default = html)
* @param {string} opt.title notification title (optional)
* @param {string} opt.sound sound which will be played upon receiving notification (optional)
* @param {string} opt.device used to send notification to a single device (optional)
* @param {string} opt.priority message priority (lowest, low, normal, high, emergency)
* @param {integer} opt.retry  keep notifying user every X seconds until acknowledged (optional, min = 30) (ignored if 'opt.priority' != 'emergency')
* @param {integer} opt.expire specifies how many seconds notification will continue to be retried for (every retry seconds). If the notification has not been acknowledged in expire seconds, it will be marked as expired and will stop being sent to the user (optional, max = 10800) (ignored if 'priority' != 'emergency')
* @param {integer} opt.timestamp can be used to override message timestamp
* @param {string} opt.url url to open
* @param {string} opt.urlTitle title to display instead of the url (will be ignored if 'opt.url' is not set)
* @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
*/
pushOverNotify(message, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {
        message:message
    };
    _.forEach(['format', 'title','sound','device','priority','retry','expire','timestamp', 'url', 'urlTitle'], (key) => {
        if (undefined !== opt[key])
        {
            params[key] = opt[key];
        }
    });
    let url = this._getUrl('pushover/notify');
    return this._makeRequest('POST', url, params);
}

//-- tickerMonitor alerts

/**
 * Returns a new object to help build condition
 */
getTickerMonitorConditionBuilder()
{
    return new TickerMonitorConditionBuilder();
}

/**
 * Retrieves a single alert
 * @param {integer} id alert id
 */
getTickerMonitorAlert(id)
{
    let url = this._getUrl(`tickerMonitor/${id}`);
    return this._makeRequest('GET', url);
}

/**
 * Retrieves a list of existing alerts
 * @param {string} name used to only retrieve alerts matching a given name (optional)
 */
getTickerMonitorAlerts(name)
{
    let params = {};
    if (undefined !== name && '' != name)
    {
        params.name = name;
    }
    let url = this._getUrl('tickerMonitor');
    return this._makeRequest('GET', url, params);
}

/**
* Declares a new alert
*
* @param {string} name alert name
* @param {object[]|TickerMonitorConditionBuilder} conditions array of conditions
* @param {boolean} opt.enabled whether or not alert should be enabled (optional, default = true)
* @param {string} opt.any whether or not one condition is enough to make alert active (optional, default = false)
* @param {boolean} opt.pushover.enabled whether or not pushover should be enabled (optional, default = false)
* @param {string} opt.pushover.priority (push over priority, default = normal)
* @param {string} opt.pushover.minDelay (minimum number of seconds between 2 notifications, to avoid spamming) (optional, default = 300, 5 min)
* @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
*/
async createTickerMonitorAlert(name, conditions, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    if (!conditions instanceof TickerMonitorConditionBuilder && !Array.isArray(conditions))
    {
        throw new Errors.ClientError.InvalidRequest.InvalidParameter('conditions', conditions, "Parameter 'conditions' should be a 'TickerMonitorConditionBuilder' object or an array");
    }
    let params = {
        name:name,
        enabled:true,
        any:false,
        pushover:{
            enabled:false
        }
    }
    if (false === opt.enabled)
    {
        params.enabled = false;
    }
    if (false === opt.any)
    {
        params.any = false;
    }
    if (undefined !== opt.pushover && true === opt.pushover.enabled)
    {
        params.pushover.enabled = true;
        params.pushover.priority = 'normal';
        params.pushover.minDelay = 300;
        if (undefined !== opt.pushover.priority)
        {
            params.pushover.priority = opt.pushover.priority;
        }
        if (undefined !== opt.pushover.minDelay)
        {
            params.pushover.priority = opt.pushover.minDelay;
        }
    }
    if (conditions instanceof TickerMonitorConditionBuilder)
    {
        params.conditions = conditions.get();
    }
    else
    {
        params.conditions = conditions;
    }
    let url = this._getUrl('tickerMonitor');
    return this._makeRequest('POST', url, params, true);
}

/**
* Updates an existing alert
*
* @param {integer} id alert id
* @param {string} opt.name new alert name (optional)
* @param {object[]|TickerMonitorConditionBuilder} opt.conditions new conditions (optional)
* @param {boolean} opt.enabled whether or not alert should be enabled (optional)
* @param {string} opt.any whether or not one condition is enough to make alert active (optional)
* @param {boolean} opt.pushover.enabled whether or not pushover should be enabled (optional)
* @param {string} opt.pushover.priority (push over priority)
* @param {string} opt.pushover.minDelay (minimum number of seconds between 2 notifications, to avoid spamming) (optional)
* @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
*/
async updateTickerMonitorAlert(id, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.conditions)
    {
        if (!opt.conditions instanceof TickerMonitorConditionBuilder && !Array.isArray(opt.conditions))
        {
            throw new Errors.ClientError.InvalidRequest.InvalidParameter('opt.conditions', opt.conditions, "Parameter 'opt.conditions' should be a 'TickerMonitorConditionBuilder' object or an array");
        }
        if (opt.conditions instanceof TickerMonitorConditionBuilder)
        {
            params.conditions = opt.conditions.get();
        }
        else
        {
            params.conditions = opt.conditions;
        }
    }
    _.forEach(['name','enabled','any','pushover'], (k) => {
        if (undefined !== opt[k])
        {
            params[k] = opt[k];
        }
    });
    let url = this._getUrl(`tickerMonitor/${id}`);
    return this._makeRequest('PATCH', url, params, true);
}

/**
 * Enables / disables a list of alerts
 * @param {boolean} flag true to enable alerts, false to disable alerts
 * @param {integer[]} list array of alerts id to enable/disable
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
enableTickerMonitorAlerts(flag, list)
{
    let params = {
        enabled:flag,
        list:list
    }
    let url = this._getUrl(`tickerMonitor`);
    return this._makeRequest('PATCH', url, params, true);
}

/**
 * Deletes a list of alerts
 * @param {integer[]} list array of alerts id to delete
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
deleteTickerMonitorAlerts(list)
{
    let params = {
        list:list
    }
    let url = this._getUrl(`tickerMonitor`);
    return this._makeRequest('DELETE', url, params, true);
}

//-- sessions
/**
 * List existing RPC sessions
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getSessions()
{
    let params = {rpc:true};
    let url = this._getUrl(`sessions`);
    return this._makeRequest('GET', url, params);
}

/**
 * Retrieves an RPC session
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
getSession(sid)
{
    let url = this._getUrl(`sessions/${sid}`);
    return this._makeRequest('GET', url);
}

/**
 * Creates a new RPC session
 *
 * @param {string} sid session id
 * @param {boolean} expires whether or not session will expire after all WS connections have been closed (optional, default = false)
 * @param {integer} timeout Number of second to wait before marking session as expired, after all WS connections have been closed (optional, default = 600) (will be ignored if expires is false)
 * @return {Promise} Promise which will resolve to the data returned by gateway or reject a BaseError exception
 */
createSession(sid, opt)
{
    if (undefined === opt)
    {
        opt = {};
    }
    let params = {};
    if (undefined !== opt.expires)
    {
        params.expires = opt.expires;
        if (params.expires && undefined !== opt.timeout)
        {
            params.timeout = opt.timeout;
        }
    }
    let url = this._getUrl(`sessions/${sid}`);
    return this._makeRequest('POST', url, params);
}

/**
 * Updates expiry for an RPC session
 *
 * @param {string} sid session id
 * @param {boolean} expires whether or not session should expire
 * @param {integer} session timeout (optional, default = 600) (will be ignored if 'expires' is false)
 */
updateSessionExpiry(sid, expires, timeout)
{
    let params = {expires:expires};
    if (params.expires && undefined !== timeout)
    {
        params.timeout = timeout;
    }
    let url = this._getUrl(`sessions/${sid}`);
    return this._makeRequest('PATCH', url, params);
}

/**
 * Deletes an RPC session
 */
deleteSession(sid)
{
    let url = this._getUrl(`sessions/${sid}`);
    return this._makeRequest('DELETE', url);
}

/**
 * Adds ticker subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to add subscription for
 */
addTickersSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/tickers/${pair}`);
    return this._makeRequest('POST', url);
}

/**
 * Cancel ticker subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to cancel subscription for
 */
cancelTickersSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/tickers/${pair}`);
    return this._makeRequest('DELETE', url);
}

/**
 * Adds order book subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to add subscription for
 */
addOrderBookSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/orderBooks/${pair}`);
    return this._makeRequest('POST', url);
}

/**
 * Cancel order book subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to cancel subscription for
 */
cancelOrderBookSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/orderBooks/${pair}`);
    return this._makeRequest('DELETE', url);
}

/**
 * Adds trades subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to add subscription for
 */
addTradesSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/trades/${pair}`);
    return this._makeRequest('POST', url);
}

/**
 * Cancel trades subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to cancel subscription for
 */
cancelTradesSubscription(sid, exchangeId, pair)
{
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/trades/${pair}`);
    return this._makeRequest('DELETE', url);
}

/**
 * Adds klines subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to add subscription for
 * @param {string} interval kline interval (optional)
 */
addKlinesSubscription(sid, exchangeId, pair, interval)
{
    let params = {};
    if (undefined !== interval)
    {
        params.interval = interval;
    }
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/klines/${pair}`);
    return this._makeRequest('POST', url, params);
}

/**
 * Cancel klines subscription for a given pair
 *
 * @param {string} sid session id
 * @param {string} exchangeId exchange identifier (ex: binance)
 * @param {string} pair pair to cancel subscription for
 * @param {string} interval kline interval (optional, if not set subscriptions will be cancelled for all klines intervals)
 */
cancelKlinesSubscription(sid, exchangeId, pair, interval)
{
    let params = {};
    if (undefined !== interval)
    {
        params.interval = interval;
    }
    let url = this._getUrl(`sessions/${sid}/subscriptions/${exchangeId}/trades/${pair}`);
    return this._makeRequest('DELETE', url, params);
}

}
module.exports = Client;
