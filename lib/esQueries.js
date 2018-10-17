'use strict';

const uuid = require('uuid/v4');

module.exports = (context) => {
    const { connection } = context.sysconfig.teranaut;
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

    function deleteRecord(index, type, fields) {
        const query = {
            index,
            type,
            id: fields.uuid
        };

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
    }

    function newRule(index, type, fields) {
        const newUuid = uuid();
        const query = {
            index,
            type,
            id: newUuid,
            body: fields
        };
        // include new uuid in record
        query.body.uuid = newUuid;
        return esClient.index(query);
    }

    return {
        deleteRecord,
        newRule,
        search,
        updateRule
    };
};
