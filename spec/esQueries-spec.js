'use strict';

const _ = require('lodash');

let deleteQuery;
let searchQuery;
let updateQuery;
let indexQuery;

const context = {
    sysconfig: {
        teraserver: {
            connection: 'default'
        }
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
        uuid: '1234',
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
        const index = 'test-v1';
        const type = 'test';
        const result = await esQueries.deleteRecord(index, type, fields);
        expect(result).toBe('delete endpoint');
        expect(deleteQuery).toEqual({ index: 'test-v1', type: 'test', id: '1234' });
    });

    it('should create a proper search request and return the response', async () => {
        const index = 'test-v1';
        const type = 'test';
        const terms = 'name: big_rule';
        const result = await esQueries.search(index, type, terms);
        expect(result).toBe('search endpoint');
        expect(searchQuery).toEqual({ index: 'test-v1', type: 'test', q: 'name: big_rule' });
    });

    it('should create a proper update request and return the response', async () => {
        const index = 'test-v1';
        const type = 'test';
        const result = await esQueries.updateRule(index, type, fields);
        expect(result).toBe('update endpoint');
        expect(updateQuery).toEqual({
            index: 'test-v1',
            type: 'test',
            id: '1234',
            body: {
                doc: fields
            }
        });
    });

    it('should create a proper index request and return the response', async () => {
        const index = 'test-v1';
        const type = 'test';
        const newFields = _.cloneDeep(fields);
        // removed uuid from fields
        delete newFields.uuid;
        const result = await esQueries.newRule(index, type, newFields);
        expect(result).toBe('index endpoint');
        // need to adjust for a new uuid
        const newUuid = indexQuery.id;
        newFields.uuid = newUuid;
        expect(indexQuery.body.uuid).toBeDefined();
        expect(indexQuery).toEqual({
            index: 'test-v1',
            type: 'test',
            id: newUuid,
            body: newFields
        });
    });
});
