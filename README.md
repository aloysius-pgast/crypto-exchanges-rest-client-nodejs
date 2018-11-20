# crypto-exchanges-rest-client

Node.js REST client for [Crypto Exchanges Gateway](https://github.com/aloysius-pgast/crypto-exchanges-gateway)

Compatible with gateway version >= 1.7.7

## Supported features

Client provides methods to perform the following :

- retrieve pairs
- retrieve tickers
- list tickers for a list of pairs
- retrieve order book for a given pair
- retrieve last trades for a given pair
- list open orders
- list closed orders
- retrieve a single order
- create an order
- cancel an order
- retrieve balances
- retrieve Market Cap informations
- convert between fiat currencies
- send push notification using _Push Over_
- manage RPC sessions
- manage _Ticker Monitor_ alerts

## How to use it

See [examples in _examples_ directory](https://github.com/aloysius-pgast/crypto-exchanges-rest-client-nodejs/tree/master/examples/) for some examples

See [Crypto Exchanges Gateway documentation](https://github.com/aloysius-pgast/crypto-exchanges-gateway/tree/master/doc) for a description of each REST API use by this module

## TLDR example

See [examples in _examples_ directory](https://github.com/aloysius-pgast/crypto-exchanges-rest-client-nodejs/tree/master/examples/) for more examples

```
const Client = require('crypto-exchanges-rest-client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

// check if gateway version is compatible
restClient.isCompatible().then((compatible) => {
    if (!compatible)
    {
        console.log('Not compatible with gateway');
        return;
    }
    // retrieve tickers from Binance
    restClient.getTickers('binance', ['USDT-NEO', 'BTC-GAS']).then((data) => {
        console.log('Tickers from Binance :')
        console.log(JSON.stringify(data, null, 4) + "\n");
    });

    // retrieve order book from Bittrex
    restClient.getOrderBook('bittrex', 'USDT-NEO').then((data) => {
        console.log('Order book from Bittrex :')
        console.log(JSON.stringify(data, null, 4) + "\n");
    });

    // retrieve last trades from Poloniex
    restClient.getTrades('poloniex', 'BTC-GAS').then((data) => {
        console.log('Last trades from Poloniex :')
        console.log(JSON.stringify(data, null, 4) + "\n");
    });

    // retrieve Market Cap informations
    restClient.getMarketCapTickers({symbols:['NEO']}).then((data) => {
        console.log('Market Cap tickers :')
        console.log(JSON.stringify(data, null, 4) + "\n");
    });
});

```
