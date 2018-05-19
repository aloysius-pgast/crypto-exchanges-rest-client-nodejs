"use strict";

/*
This example show how to send a push notification using PushOver
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

let opt = {
    title:'Time to buy NEO !',
    message: "Price does not matter, it's always time to buy NEO",
    url: "https://coinmarketcap.com/currencies/neo/"
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
        // ensure service is supported
        if (!restClient.checkService(services, 'pushover'))
        {
            console.log(`PushOver service is not enabled on gateway`);
            process.exit(1);
        }
        return restClient.pushOverNotify(opt.message, {title:opt.title,url:opt.url}).then((data) => {
            console.log('Message successfully sent');
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
