"use strict";
const _ = require('lodash');
const url = require('url');

/*
This class only contains a few helpers used by examples 
 */

class Helpers
{

/**
 * Returns a sample for an array|object
 *
 * @param {array|object} entity array or object to get sample for
 * @param {integer} size sample size (default = 3)
 * @return {array|object}
 */
static getSample(entity, size)
{
    if (undefined === size)
    {
        size = _.size(entity);
    }
    if (Array.isArray(entity))
    {
        return _.sampleSize(entity, size);
    }
    let obj = {};
    let keys = _.sampleSize(Object.keys(entity), size);
    _.forEach(keys, (k) => {
        obj[k] = entity[k];
    });
    return obj;
}

/**
 * Returns an object describing an array
 *
 * @param {array} arr array to describe
 * @return {object} {size:integer,first:object,last:object}
 */
static describeArray(arr, size)
{
    let obj = {size:arr.length};
    if (0 != arr.length)
    {
        obj.first = arr[0];
        obj.last = arr[arr.length - 1];
    }
    return obj;
}

/**
 * Stringify an object
 *
 * @param {object} obj obj to stringify
 */
static stringify(obj)
{
    return JSON.stringify(obj, null, 4);
}

/**
 * Returns a ws uri based on http uri
 *
 * @param {string} httpUri http|https uri
 * @param {string} path http path
 */
static getWsUri(httpUri)
{
    let u = url.parse(httpUri);
    let wsProtocol = 'ws';
    if ('https' == u.protocol)
    {
        wsProtocol = 'wss';
    }
    let wsUri = `${wsProtocol}://${u.hostname}:8001`;
    return wsUri;
}

}

module.exports = Helpers;
