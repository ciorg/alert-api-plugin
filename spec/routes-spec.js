'use strict';

const express = require('express');
const got = require('got');
const _ = require('lodash');
const bodyParser = require('body-parser');

let deleteResult;
let deleteError = false;
let postResult = true;

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
                    search: () => Promise.resolve({
                        hits: {
                            hits: [
                                {
                                    _index: 'test-index',
                                    _type: 'test-type',
                                    _source: {
                                        user_id: '1234',
                                        data: 'data1'
                                    }
                                },
                                {
                                    _index: 'test-index',
                                    _type: 'test-type',
                                    _source: {
                                        user_id: '1234',
                                        data: 'data2'
                                    }
                                }
                            ]
                        }
                    }),
                    delete: (query) => {
                        if (deleteError) return Promise.reject(new Error('Not Found'));
                        return Promise.resolve({
                            found: true,
                            _index: 'rules-v1',
                            _type: 'rule',
                            _id: query.id,
                            _version: 3,
                            result: deleteResult,
                            _shards: { total: 2, successful: 1, failed: 0 }
                        });
                    },
                    update: () => Promise.resolve('update endpoint'),
                    index: query => Promise.resolve({
                        _index: 'rules-v1',
                        _type: 'rule',
                        _id: query.uuid,
                        _version: 1,
                        result: 'created',
                        _shards: { total: 2, successful: 1, failed: 0 },
                        created: postResult
                    })
                }
            })
        }
    }
};

const ruleFields = {
    name: 'rule1',
    watch_type: 'expression',
    spaces: 'space1',
    user_id: 'u123',
    criteria: 'name: joe',
    alert_message: 'do something',
    include_record: true,
    record_fields: [
        'name',
        'ip'
    ],
    reset_criteria: {
        alert_count: 10,
        reset_count: 30,
        reset_units: 'min'
    },
    actions: [
        {
            action_type: 'email',
            to: 'you@name.com',
            from: 'me@name.com',
            body: 'more info',
            subject: 'email subject'
        },
        {
            action_type: 'webhook',
            url: 'this.is.the.url.io',
            message: 'this is an alert',
            token: 'thisisatoken'
        }
    ]
};

describe('alerts-api should allow for users to interact with api endpoints', () => {
    beforeEach(() => {
        // originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
    });

    const addUserId = function (req, res, next) {
        _.set(req, 'user.id', '1234');
        next();
    };

    const app = express();
    app.use(bodyParser.json());
    app.use(addUserId);
    // app.use(errorhandler());
    config.app = app;
    require('../lib/routes')(config);
    app.listen(3000);
    const url = 'http://localhost:3000/api/v1/alerts/watch';

    it('get alerts/rules should search for rules by user_id', async () => {
        try {
            const result = await got.get(url);
            const resultParsed = (JSON.parse(result.body));
            expect(resultParsed.length).toBe(2);
            expect(resultParsed[0]._source.data).toBe('data1');
            expect(resultParsed[1]._source.data).toBe('data2');
        } catch (e) {
            fail(e);
        }
    });

    it('delete alerts/rules should delete rule by uuid', async () => {
        try {
            const requestData = {
                id: 'u1234'
            };
            deleteError = false;
            deleteResult = 'deleted';
            const options = {
                json: true,
                body: requestData
            };

            const result = await got.delete(url, options);
            expect(result.body).toEqual({ message: 'Watch u1234 was deleted' });
        } catch (e) {
            fail(e);
        }
    });

    it('delete alerts/rules should handle if status is not delete', async () => {
        try {
            const requestData = {
                id: 'u1234'
            };
            deleteError = false;
            deleteResult = 'not deleted';
            const options = {
                json: true,
                body: requestData
            };

            await got.delete(url, options);
        } catch (e) {
            expect(e.statusCode).toBe(500);
        }
    });

    it('delete alerts/rules should handle if uuid is not found', async () => {
        const requestData = {
            id: 'u1234'
        };
        deleteError = true;
        const options = {
            json: true,
            body: requestData
        };

        try {
            await got.delete(url, options);
        } catch (e) {
            expect(e.statusCode).toBe(501);
            // expect(e.message).toEqual({ error: 'Could not find rule with uuid: u1234' });
        }
    });

    it('post alerts/watch should create a new watch', async () => {
        const newRule = _.cloneDeep(ruleFields);
        delete newRule.id;
        postResult = 'created';
        try {
            const options = {
                json: true,
                body: newRule
            };

            const result = await got.post(url, options);
            expect(result.body).toEqual({ message: 'created new watch' });
        } catch (e) {
            fail(e);
        }
    });

    it('post alerts/rules should report that rule was not created', async () => {
        const newRule = _.cloneDeep(ruleFields);
        delete newRule.id;
        postResult = false;
        try {
            const options = {
                json: true,
                body: newRule
            };

            await got.post(url, options);
        } catch (e) {
            // console.log(e);
            expect(e.statusCode).toBe(500);
        }
    });
});
