"use strict";

/*
This example show how to enable/disable existing tickerMonitor alerts
*/
const _ = require('lodash');
const Helpers = require('../../lib/helpers');
const Client = require('../../../lib/client');

// this is the default
const baseUri = 'http://127.0.0.1:8000';
const restClient = new Client.RestClient({baseUri:baseUri});

// list of alerts to enable/disable
const alerts = [1, 2, 3];
// set to true to enable above alerts
const enable = false;

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
        return restClient.enableTickerMonitorAlerts(enable, alerts).then((data) => {
            let action = enable ? 'enabled' : 'disabled';
            console.log(`Alerts successfully ${action} :`);
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
