'use strict';

const express = require('express');
const got = require('got');
const ioClient = require('socket.io-client');
const http = require('http');
const _ = require('lodash');
const bodyParser = require('body-parser');

const rules = require('./fixtures/rules');

const user = '1';

function fullESResponse(data, index, type) {
    const hitsArray = data.map((i) => {
        const esItem = {
            _index: index,
            _type: type,
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
                        const { index } = query;
                        const { type } = query;
                        const fullEs = fullESResponse(rules, index, type);
                        fullEs.hits.hits = fullEs.hits.hits
                            .filter(rule => rule._source.user_id === user);
                        return Promise.resolve(fullEs);
                    },
                    delete: () => Promise.resolve('delete endpoint'),
                    update: () => Promise.resolve('update endpoint'),
                    index: query => Promise.resolve({
                        _index: 'rules-v1',
                        _type: 'rule',
                        _id: query.uuid,
                        _version: 1,
                        result: 'created',
                        _shards: { total: 2, successful: 1, failed: 0 },
                        created: true
                    })
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
    // afterAll(() => killServer());
    const url = 'http://localhost:3000/api/v1/alerts-graphql';

    fit('should return all rules associated with a user', async () => {
        const requestData = {
            query: 'query getRules {getRules {name}}'
        };
        const options = {
            json: true,
            body: requestData
        };

        const result = await got.post(url, options);
        expect(result.body.data.getRules.length).toBe(4);
    });

    fit('should filter rules by arguments, only watchType expression', async () => {
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

        const result = await got.post(url, options);
        const queryData = result.body.data.getRules;
        expect(queryData.length).toBe(1);
        expect(queryData[0].watch_type).toBe('EXPRESSION');
    });

    fit('should filter rules by arguments, only email actions', async () => {
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

        const result = await got.post(url, options);
        expect(result.body.data.getRules.length).toBe(3);
        expect(result.body.data.getRules[0].actions[0].action_type).toBe('EMAIL');
        expect(result.body.data.getRules[1].actions[0].action_type).toBe('EMAIL');
    });

    fit('should filter rules by arguments, watchType: fieldmatch, actionType: webook', async () => {
        const requestData = {
            query: 'query getRules {getRules(watchType: FIELDMATCH, actionType:WEBHOOK) {' +
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

        const result = await got.post(url, options);
        expect(result.body.data.getRules.length).toBe(2);
        expect(result.body.data.getRules[0].watch_type).toBe('FIELDMATCH');
        expect(result.body.data.getRules[0].actions[1].action_type).toBe('WEBHOOK');
        expect(result.body.data.getRules[0].actions.length).toBe(2);
        expect(result.body.data.getRules[1].actions[0].action_type).toBe('WEBHOOK');
    });

    fit('should create new rules for a user', () => {

    });
});
