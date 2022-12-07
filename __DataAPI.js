/*****************************************************************************************************
 * 
 * Version 1
 * 7 December 2022
 * Bert-Jan Fransen
 * 
 * Content:
 * -getRecordList
 * -getRecord
 * -insertRecord
 * -createProcessRecordFunction
 * 
 */




var __DataAPI = Class.create();
__DataAPI.prototype = {
    initialize: function () {},
    
    /**
     * Retrieves data from a table
     *
     * @param {Object} - options - parameters are passed in through an options object
     * @param {string} options.table - the table to query
     * @param {string} options.query - encoded query string
     * @param {string[]} options.queries - array of queries, each of which will be AND-ed
     * @param {string[]} options.fieldList - list of fields whose values will be returned
     * @param {string} options.orderBy - field name of the field to be ordered by
     * @param {boolean} options.orderDescending - true for descending order, false (default) for ascending
     * @param {number} options.max - the number of records to be returned, -1 returns all
     * @param {string} options.returnValue - what field values to return. values can be value, display, both - for returning values, display values or both
     * @returns {record[]} - array with records and name value pairs of the fieldList (both display and value).
     */
    getRecordList: function (options) {
        if (typeof options != 'object') throw Error('No options provided', 'getRecordListOptions');
        if (typeof options.table !== 'string') throw Error('No table provided or table is not a string', 'getRecordListOptions');
        // if (typeof options.query !== 'string') throw Error('No query provided or query is not a string', 'getRecordListOptions');
        if (!options.fieldList || !Array.isArray(options.fieldList) || options.fieldList.length === 0) throw Error('fieldList should be a non-empty array');
        if (typeof options.max === 'undefined'){
            options.max = -1;
        }
        if (typeof options.returnValue === 'undefined'){
            options.returnValue = 'value';
        }
        
        var queries = options.queries || [];
        if (typeof options.query === 'string'){
            queries.push(options.query);
        }

        // determine which function to use to convert a single record to an object to be returned
        // the function depends on whether or not to dotwalk, and which field values are to be returned,
        // both of which we know before querying. therefore these checks are performed outside the while loop
        var processRecord = this.createProcessRecordFunction(options.fieldList, options.returnValue);

        var gr = new GlideRecord(options.table);

        queries.forEach(function(query){
            gr.addQuery(query);
        })

        if (typeof options.max === 'number' && options.max > -1) {
            gr.setLimit(options.max);
        }

        if (typeof options.orderBy === 'string' && gr.isValidField(options.orderBy)){
            if (options.orderDescending){
                gr.orderBy(options.orderBy);
            } else {
                gr.orderByDesc(options.orderBy);
            }
        }

        gr.query();

        var result = [];
        while (gr.next()) {
            result.push(processRecord(gr));
        }

        return result;
    },   

    /**
     * Retrieves a single record.
     * If a query is provided, that is used. The options field, value, sys_id are ignored if provided
     * If no query is present, the sys_id is used to find a match. If no sys_id is provided, the field and value
     * are matched.
     * @param {Object} options - parameters passed in as an object
     * @param {string} options.table - table name
     * @param {string} options.query - query to be run on options.table
     * @param {string} options.sys_id - sys_id of the record to be found
     * @param {string} options.field - field name
     * @param {string} options.value - value for to match field name
     * @param {string[]} options.fieldList - array of field names to be returned
     * @param {string} options.returnValue - what field values to return. values can be value, display, both - for returning values, display values or both
     * @returns {Object}
     */
    getRecord: function(options){
        if (typeof options.table !== 'string') throw Error('Property table is not provided to options argument', 'getRecord');
        if (!options.fieldList) throw Error('Property fieldList is not provided to options argument', 'getRecord');
        if (!Array.isArray(options.fieldList)) throw Error('Property fieldList is not an array', 'getRecord');
        if (options.fieldList.length === 0) throw Error('Property fieldList is an empty array', 'getRecord');

        // generate the function which converts a GlideReord to a field/value object based on the options provided
        var processRecord = this.createProcessRecordFunction(options.fieldList, options.returnValue);
        var gr = new GlideRecord(options.table);

        if (typeof options.sys_id === 'string'){
            if (gr.get(options.sys_id)){
                return processRecord(gr);
            }
        }
        if (typeof options.field === 'string' && typeof options.value === 'string'){
            if (gr.get(options.field, options.value)){
                return processRecord(gr);
            }
        }
        if (typeof options.query === 'string'){
            var list = this.getRecordList(options.table, options.query, options.fieldList, 1);
            return list[0];
        }

        return null;
    },
    
    /**
     * Inserts a record in the database
     * @param {Object} options - parameters passed in as an object
     * @param {string} options.table - table name
     * @param {Object} options.values - field/value pairs
     * @param {string} options.values.field - name of the field
     * @param {string|number|boolean} options.values.field.value - value of the field
     * @returns {string} - return value of GlideRecord.insert (sys_id of the inserted record or null on failure)
     */
    insertRecord: function (options) {
        if (typeof options.table !== 'string') throw Error('No table provided or table is not a string', 'insertRecord');
        if (typeof options.values !== 'object') throw Error('No values provided or values is not an object', 'insertRecord');

        var gr = new GlideRecord(options.table);
        for (var field in options.values) {
            gr.setValue(field, options.values[field]);
        }

        return gr.insert();
    },
    
    deleteRecords: function(options){
        var gr = new GlideRecord(options.table);
        return gr.deleteMultiple(options.query);
    },
       
    createProcessRecordFunction: function(fieldList, returnValue){
        var getValues = getValuesFunction(fieldList);
        return function(gr){
            var record = {};
            fieldList.forEach(function (field) {
                record[field] = getValues(gr, field, returnValue);
            }, this);

            return record;
        }
    }
};


/**
 * Section below contains private functions
 */



/**
 * The dotwalking algorithm is expensive when compared to the regular getValue. The last one just takes the
 * field name and passes it on the GlideRecord.getValue. The former needs to split the dotwalked field name on
 * dots, and iterate over the array, using subsequent field names to perform the dotwalk.
 * Since we know the field names before we start, we can determine whether dotwalking can be skipped - if none of the
 * field names contains a dot. If so, we return the regular (faster) getValue function, otherwise we will use the
 * dotwalking algorithm.
 * @param {string[]} fieldList - list of the field names
 * @returns {Function} - function to be used to retrieve value/display value pairs from a gliderecord
 */
function getValuesFunction(fieldList){
    var dotwalk = (fieldList.some(function(field){
        return field.indexOf('.') > -1;
    }));

    return dotwalk ? _getDotWalkValues : _getValues;
}

/**
 * Returns the value and display value of a field. Does not support dotwalking
 * @param {GlideRecord} gr - glide record variable
 * @param {string} field - field name
 * @param {string} returnValue - determines the return value, being either the field's value, display value or both
 * @returns {Object|string} - object has two keys: value and display, if type is string only one of those will be returned
 */
function _getValues(gr, field, returnValue) {
    switch (returnValue){
        case 'value': return gr.getValue(field);
        case 'display': return gr.getDisplayValue(field);
        default:
            return {
                value: gr.getValue(field),
                display: gr.getDisplayValue(field)
            };
    }
}

/**
 * Returns the value and display value of a field. Supports dotwalking
 * @param {GlideRecord} gr - glide record variable
 * @param {string} field - field name
 * @param {string} returnValue - determines the return value, being either the field's value, display value or both
 * @returns {Object|string} - object has two keys: value and display, if type is string only one of those will be returned
 */
function _getDotWalkValues(gr, field, returnValue) {
    if (typeof field !== 'string') return;

    var fields;
    fields = field.split('.');
    do
        gr = gr[fields.shift()];
    while (fields.length > 0);

    switch (returnValue){
        case 'value': return gr.getValue();
        case 'display': return gr.getDisplayValue();
        default:
            return {
                value: gr.getValue(),
                display: gr.getDisplayValue()
            };
    }
}

function Error(e, functionName){
    if (typeof e === 'string'){
        // custom generated error
        var source = '__DataAPI';
        if (typeof functionName === 'string') source += '.'+functionName;
        return {
            hasError: true,
            name: '__DataAPI error',
            message: source + ': ' + e
        };
    } else {
        // system generated error
        return {
            hasError: true,
            message: e.message,
            name: e.name || '__DataAPI error',
            lineNumber: e.lineNumber
        };
    }
}
