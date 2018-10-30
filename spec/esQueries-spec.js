'use strict';

const _ = require('lodash');

let deleteQuery;
let searchQuery;
let updateQuery;
let indexQuery;

const context = {
    sysconfig: {
        teraserver: {
            connection: 'default',
            plugins: {
                alert_api: {
                    watch_index: 'watch-v1',
                    watch_type: 'watch'
                }
            }
        },
    },
    foundation: {
        getConnection: () => ({
            client: {
                search: (query) => {
                    searchQuery = query;
                    return Promise.resolve('search endpoint');
                },
                delete: (query) => {
                    deleteQuery = query;
                    return Promise.resolve('delete endpoint');
                },
                update: (query) => {
                    updateQuery = query;
                    return Promise.resolve('update endpoint');
                },
                index: (query) => {
                    indexQuery = query;
                    return Promise.resolve('index endpoint');
                }
            }
        })
    }
};

const esQueries = require('../lib/esQueries')(context);

describe('esQueries', () => {
    const fields = {
        name: 'rule1',
        id: '1234',
        spaces: 'space1',
        user_id: 'u123',
        criteria: 'name: joe',
        alert_message: 'do something',
        include_record: true,
        record_fields: ['name', 'ip'],
        reset_criteria: {
            alert_count: 10,
            reset_count: 30,
            reset_units: 'min'
        },
        actions: [
            {
                type: 'email',
                to: 'you@name.com',
                from: 'me@name.com',
                body: 'more info',
                subject: 'email subject'
            }
        ]
    };

    it('should create a proper delete request and return the response', async () => {
        const result = await esQueries.deleteWatch('1234');
        expect(result).toBe('delete endpoint');
        expect(deleteQuery).toEqual({ index: 'watch-v1', type: 'watch', id: '1234' });
    });

    it('should create a proper search request and return the response', async () => {
        const terms = 'name: big_rule';
        const result = await esQueries.search(terms);
        expect(result).toBe('search endpoint');
        expect(searchQuery).toEqual({ index: 'watch-v1', type: 'watch', q: 'name: big_rule' });
    });

    it('should create a proper update request and return the response', async () => {
        const result = await esQueries.updateWatch(fields);
        expect(result).toBe('update endpoint');
        expect(updateQuery).toEqual({
            index: 'watch-v1',
            type: 'watch',
            id: '1234',
            body: {
                doc: fields
            }
        });
    });

    it('should create a proper index request and return the response', async () => {
        const newFields = _.cloneDeep(fields);
        // removed id from fields
        delete newFields.id;
        const result = await esQueries.newWatch(newFields);
        expect(result).toBe('index endpoint');
        // need to adjust for a new uuid
        const newUuid = indexQuery.id;
        newFields.uuid = newUuid;
        expect(indexQuery).toEqual({
            index: 'watch-v1',
            type: 'watch',
            id: newUuid,
            body: newFields
        });
    });
});
