'use strict';

const uuid = require('uuid/v4');
const _ = require('lodash');

module.exports = (context) => {
    const index = context.sysconfig.teraserver.plugins.alert_api.watch_index;
    const type = context.sysconfig.teraserver.plugins.alert_api.watch_type;
    const { connection } = context.sysconfig.teraserver;

    const esClient = context.foundation.getConnection({
        type: 'elasticsearch',
        endpoint: connection,
        cached: true
    }).client;

    function search(terms, searchIndex = index, searchType = type) {
        const query = {
            index: searchIndex,
            type: searchType,
            q: terms
        };
        return esClient.search(query);
    }

    function deleteWatch(id, deleteIndex = index, deleteType = type) {
        const query = {
            index: deleteIndex,
            type: deleteType,
            id
        };
        /*
        found: true,
        _index: 'rules-v1',
        _type: 'rule',
        _id: query.uuid,
        _version: 3,
        result: deleted,
        _shards: { total: 2, successful: 1, failed: 0 }
        */

        return esClient.delete(query);
    }
    function updateWatch(fields, updateIndex = index, updateType = type) {
        const query = {
            index: updateIndex,
            type: updateType,
            id: fields.id
        };
        // remove id from body since it's already in the query
        delete fields.id;
        // set doc to fields
        _.set(query, 'body.doc', fields);
        return esClient.update(query);
        /*
        {
            _index: 'rules-v1',
            _type: 'rule',
            _id: 'cfc45b45-b748-4074-a28d-8a235c9dfeb3',
            _version: 2,
            result: 'updated',
            _shards: { total: 2, successful: 1, failed: 0 }
        }
        */
    }

    function newWatch(fields, newIndex = index, newType = type) {
        const newUuid = uuid();
        const query = {
            index: newIndex,
            type: newType,
            id: newUuid,
            body: fields
        };
        return esClient.index(query);
        /* response from es
            {
                _index: 'rules-v1',
                _type: 'rule',
                _id: 'ed967419-9c7d-495b-8686-64964f7bf090', // uuid created above
                _version: 1,
                result: 'created',
                _shards: { total: 2, successful: 1, failed: 0 },
                created: true
            }
        */
    }

    return {
        deleteWatch,
        newWatch,
        search,
        updateWatch
    };
};
