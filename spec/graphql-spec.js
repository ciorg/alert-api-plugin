'use strict';

const express = require('express');
const got = require('got');
const ioClient = require('socket.io-client');
const http = require('http');
const _ = require('lodash');
const bodyParser = require('body-parser');

const rules = require('./fixtures/rules');

const user = '1';
let searchQuery;
let searchResponse;
let indexQuery;

function fullESResponse(data) {
    const hitsArray = data.map((i) => {
        const esItem = {
            _index: 'rules-v1',
            _type: 'rule',
            _id: i.uuid,
            _source: i
        };
        return esItem;
    });

    return {
        hits: {
            hits: hitsArray
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
                connection: 'default'
            }
        },
        foundation: {
            getConnection: () => ({
                client: {
                    search: (query) => {
                        searchQuery = query;
                        return Promise.resolve(searchResponse);
                    },
                    delete: () => Promise.resolve('delete endpoint'),
                    update: () => Promise.resolve('update endpoint'),
                    index: (query) => {
                        indexQuery = query;
                        const indexResponse = {
                            _index: 'rules-v1',
                            _type: 'rule',
                            _id: indexQuery.id,
                            _version: 1,
                            result: 'created',
                            _shards: { total: 2, successful: 1, failed: 0 },
                            created: true
                        };
                        return Promise.resolve(indexResponse);
                    }
                }
            })
        }
    }
};


const addUserId = function (req, res, next) {
    _.set(req, 'user.id', user);
    next();
};

function startServer() {
    const app = express();
    app.use(bodyParser.json());
    app.use(addUserId);
    config.app = app;
    // add graphql middleware
    require('../lib')(config);
    // start server with http to enble the kill switch
    const server = http.createServer(app);
    server.listen(3000);
    const io = require('socket.io')(server);
    // listen for kill switch
    io.on('connection', (socketServer) => {
        socketServer.on('killServer', () => {
            process.exit(0);
        });
    });
}

function killServer() {
    const socketClient = ioClient.connect('http://localhost:3000');
    socketClient.on('connect', () => {
        socketClient.emit('killServer');
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    });
}

describe('alerts-api should allow for users to interact with rule data', () => {
    startServer();
    afterAll(() => killServer());
    const url = 'http://localhost:3000/api/v1/alerts-graphql';

    fit('should return all the logged in users rules', async () => {
        searchResponse = fullESResponse(rules);
        const requestData = {
            query: 'query getRules {' +
                'getRules {' +
                    'uuid\n' +
                    'name\n' +
                    'watch_type\n' +
                    'criteria\n' +
                    'actions {\n' +
                        'action_type\n' +
                        'url\n' +
                        'to}' +
                '}' +
            '}'
        };
        const options = {
            json: true,
            body: requestData
        };

        const result = await got.post(url, options);
        expect(result.body.data.getRules.length).toBe(4);
    });

    fit('should create a proper es search for rules with watch_type: EXPRESSION', async () => {
        searchResponse = fullESResponse(rules);
        const requestData = {
            query: 'query getRules {getRules(watchType:EXPRESSION) {' +
                    'name\n' +
                    'watch_type' +
                '}' +
            '}'
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND watch_type: EXPRESSION');
    });

    fit('should create proper es search for rules with specific action_types', async () => {
        searchResponse = fullESResponse(rules);
        const requestData = {
            query: 'query getRules {getRules(actionType:EMAIL) {' +
                'name\n' +
                'actions {' +
                    'action_type }' +
                '}' +
            '}'
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND actions.action_type: EMAIL');
    });

    fit('should create search for rules with specific id', async () => {
        searchResponse = fullESResponse(rules);
        const requestData = {
            query: 'query getRules {getRules(id:1) {' +
                'name\n' +
                'watch_type\n' +
                'actions {' +
                    'action_type }' +
                '}' +
            '}'
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND _id: 1');
    });

    fit('should create search for rules with many specific limiters', async () => {
        searchResponse = fullESResponse(rules);
        const requestData = {
            query: 'query getRules {getRules(id:1, watchType:FIELDMATCH, actionType:WEBHOOK) {' +
            'name\n' +
            'watch_type\n' +
            'actions {' +
                'action_type }' +
        '}' +
    '}'
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND _id: 1 AND watch_type: FIELDMATCH AND actions.action_type: WEBHOOK');
    });

    fit('should create new rules for a user', async () => {
        const requestData = {
            query: 'mutation addRule { ' +
                'addRule (' +
                    'name: "MyRule",' +
                    'watch_type: EXPRESSION,' +
                    'spaces: "space1"' +
                    'criteria: "ip: 1234",' +
                    'actions: {\n' +
                        'action_type: EMAIL\n' +
                        'to: ["joe@joe.com", "bob@bob.com"]\n' +
                        'from: "joe@joe.com"\n' +
                        'subject: "my subject"\n' +
                    '}' +
                ')' +
                '{' +
                    'uuid\n' +
                    'success\n' +
                    'message' +
                '}' +
            '}'
        };
        const options = {
            json: true,
            body: requestData
        };
        const response = await got.post(url, options);
        // es index query should reflect whats in the graphql addRull query
        expect(indexQuery).toEqual({
            index: 'rules-v1',
            type: 'rule',
            id: indexQuery.id,
            body: {
                name: 'MyRule',
                spaces: 'space1',
                watch_type: 'EXPRESSION',
                criteria: 'ip: 1234',
                actions: [
                    {
                        action_type: 'EMAIL',
                        to: ['joe@joe.com', 'bob@bob.com'],
                        from: 'joe@joe.com',
                        subject: 'my subject'
                    }
                ],
                user_id: '1',
                include_record: false,
                record_fields: [],
                uuid: indexQuery.id
            }
        });
        // check response
        expect(response.body.data.addRule).toEqual({
            uuid: indexQuery.id,
            success: true,
            message: 'New rule was created'
        });
    });
});
