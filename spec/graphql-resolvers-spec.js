'use strict';

let searchQuery;
let searchResponse;
let searchError = false;
let deleteQuery;
let deleteResponse;
let updateQuery;
let updateResponse;
let indexQuery;
let newUuid;

function makeFullEs(dataArray) {
    const esArray = dataArray.map((item) => {
        const es = {
            _id: '12345',
            _index: 'watch-v1',
            _type: 'watch',
            _source: item
        };
        return es;
    });

    return {
        hits: {
            hits: esArray
        }
    };
}

const config = {
    logger: {
        error: () => {}
    },
    context: {
        sysconfig: {
            teraserver: {
                connection: 'default',
                plugins: {
                    alert_api: {
                        watch_index: 'watch-v1',
                        watch_type: 'watch'
                    }
                }
            }
        },
        foundation: {
            getConnection: () => ({
                client: {
                    search: (query) => {
                        searchQuery = query;
                        if (searchError) throw new Error('this is an error');
                        return Promise.resolve(makeFullEs(searchResponse));
                    },
                    delete: (query) => {
                        deleteQuery = query;
                        return Promise.resolve(deleteResponse);
                    },
                    update: (query) => {
                        updateQuery = query;
                        return Promise.resolve(updateResponse);
                    },
                    index: (query) => {
                        indexQuery = query;
                        newUuid = query.id;
                        return Promise.resolve({
                            _index: 'watch-v1',
                            _type: 'watch',
                            _id: newUuid,
                            _version: 2,
                            result: 'created',
                            created: true,
                            _shards: { total: 2, successful: 1, failed: 0 }
                        });
                    }
                }
            })
        }
    }
};

const resolvers = require('../lib/resolvers')(config);

const obj = {};
const context = {
    user_id: '12345'
};


describe('resolvers', () => {
    it('should create es search from input', async () => {
        searchResponse = [
            {
                name: 'coolName',
                spaces: ['space1', 'space2']
            }
        ];

        const args = {
            watchProperties: {
                name: 'coolName',
                spaces: ['space1', 'space2']
            },
            actionProperties: {}
        };
        try {
            await resolvers.resolvers.Query.getWatch(obj, args, context);
            expect(searchQuery).toEqual({
                index: 'watch-v1',
                type: 'watch',
                q: 'user_id: 12345 AND name: coolName AND spaces: space1,space2'
            });
        } catch (e) {
            fail(e);
        }
    });

    it('should return error message on search error', async () => {
        searchError = true;
        const args = {
            watchProperties: {
                name: 'coolName',
                spaces: ['space1', 'space2']
            },
            actionProperties: {}
        };
        try {
            const result = await resolvers.resolvers.Query.getWatch(obj, args, context);
            expect(result.success).toBe(false);
            expect(result.message).toBe('this is an error');
        } catch (e) {
            fail(e);
        }
    });

    it('should create a correct es query to  delete a watch', async () => {
        deleteResponse = {
            found: true,
            _index: 'rules-v1',
            _type: 'rule',
            _id: '1234',
            _version: 3,
            result: 'deleted',
            _shards: { total: 2, successful: 1, failed: 0 }
        };

        const args = {
            id: '1234'
        };
        try {
            const result = await resolvers.resolvers.Mutation.deleteWatch(obj, args, context);
            expect(result.success).toBe(true);
            expect(result.message).toBe('Watch 1234 was deleted');
            expect(deleteQuery).toEqual({
                index: 'watch-v1',
                type: 'watch',
                id: '1234'
            });
        } catch (e) {
            fail(e);
        }
    });

    it('should create a correct es query to  delete a watch', async () => {
        deleteResponse = {
            found: false,
            _index: 'rules-v1',
            _type: 'rule',
            _id: '1234',
            _version: 3,
            result: 'blah blah blah',
            _shards: { total: 2, successful: 1, failed: 0 }
        };

        const args = {
            id: '1234'
        };
        try {
            const result = await resolvers.resolvers.Mutation.deleteWatch(obj, args, context);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Watch 1234 could not be deleted');
        } catch (e) {
            fail(e);
        }
    });

    it('should create a correct es query to update a watch', async () => {
        updateResponse = {
            _index: 'watch-v1',
            _type: 'watch',
            _id: '1234',
            _version: 2,
            result: 'updated',
            _shards: { total: 2, successful: 1, failed: 0 }
        };

        const args = {
            id: '1234',
            name: 'newName',
            actions: [{
                action_type: 'WEBHOOK',
                url: 'someurl',
                token: 'atoken'
            }]
        };

        try {
            const result = await resolvers.resolvers.Mutation.editWatch(obj, args, context);
            expect(updateQuery).toEqual({
                index: 'watch-v1',
                type: 'watch',
                id: '1234',
                body: {
                    doc: {
                        name: 'newName',
                        actions: [{
                            action_type: 'WEBHOOK',
                            url: 'someurl',
                            token: 'atoken'
                        }]
                    }
                }
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Watch 1234 was updated');
            expect(result.id).toBe('1234');
        } catch (e) {
            fail(e);
        }
    });

    it('should create a correct es query to index a new watch', async () => {
        const args = {
            name: 'gooderWatch',
            criteria: 'ip:123.123.8.8',
            spaces: ['space1', 'space2'],
            watch_type: 'EXPRESSION',
            actions: [{
                action_type: 'WEBHOOK',
                message: 'this is your alert',
                url: 'someurl',
                token: 'atoken'
            }]
        };

        try {
            const result = await resolvers.resolvers.Mutation.addWatch(obj, args, context);
            expect(indexQuery).toEqual({
                index: 'watch-v1',
                type: 'watch',
                id: newUuid,
                body: {
                    user_id: '12345',
                    name: 'gooderWatch',
                    criteria: 'ip:123.123.8.8',
                    spaces: ['space1', 'space2'],
                    watch_type: 'EXPRESSION',
                    actions: [{
                        action_type: 'WEBHOOK',
                        url: 'someurl',
                        token: 'atoken',
                        message: 'this is your alert'
                    }]
                }
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe(`New watch with id ${newUuid} was created`);
            expect(result.id).toBe(newUuid);
        } catch (e) {
            fail(e);
        }
    });
});
