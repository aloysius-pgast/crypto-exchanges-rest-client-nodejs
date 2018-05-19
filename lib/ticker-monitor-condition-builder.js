"use strict";
class TickerMonitorConditionBuilder
{

constructor()
{
    this._list = [];
}

/**
 * Adds an exchange condition
 * @param {string} id exchange id
 * @param {string} pair pair to monitor
 * @param {string} field field to monitor
 * @param {string} operator operator to use for comparison
 * @param {float} value expected value
 * @return {self}
 */
exchange(id, pair, field, operator, value)
{
    let c = {
        origin:{
            type:'exchange',
            id:id
        },
        condition:{
            pair:pair,
            field:field,
            operator:operator,
            value:value
        }
    }
    this._list.push(c);
    return this;
}

/**
 * Adds a coinmarket condition
 * @param {string} symbol symbol to monitor
 * @param {string} field field to monitor
 * @param {string} operator operator to use for comparison
 * @param {float} value expected value
 * @return {self}
 */
coinMarketCap(symbol, field, operator, value)
{
    let c = {
        origin:{
            type:'service',
            id:'coinmarketcap'
        },
        condition:{
            symbol:symbol,
            field:field,
            operator:operator,
            value:value
        }
    }
    this._list.push(c);
    return this;
}

/**
 * Returns the list of conditions
 */
get()
{
    return this._list;
}

}

module.exports = TickerMonitorConditionBuilder;
