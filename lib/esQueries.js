'use strict';

const uuid = require('uuid/v4');

module.exports = (context) => {
    const { connection } = context.sysconfig.teraserver;
    const esClient = context.foundation.getConnection({
        type: 'elasticsearch',
        endpoint: connection,
        cached: true
    }).client;

    function search(index, type, terms) {
        const query = {
            index,
            type,
            q: terms
        };
        return esClient.search(query);
    }

    function deleteRecord(index, type, docUuid) {
        const query = {
            index,
            type,
            id: docUuid
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
    function updateRule(index, type, fields) {
        const query = {
            index,
            type,
            id: fields.uuid,
            body: {
                doc: fields
            }
        };
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

    function newRule(index, type, fields) {
        const newUuid = uuid();
        const query = {
            index,
            type,
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
        deleteRecord,
        newRule,
        search,
        updateRule
    };
};
