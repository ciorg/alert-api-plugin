'use strict';

const express = require('express');
const got = require('got');
const ioClient = require('socket.io-client');
const http = require('http');
const _ = require('lodash');
const bodyParser = require('body-parser');

const watches = require('./fixtures/watches');

const user = '1';
let searchQuery;
let searchResponse;
let indexQuery;

function fullESResponse(data) {
    let id = 1;
    const hitsArray = data.map((i) => {
        const esItem = {
            _index: 'watches-v1',
            _type: 'watch',
            _id: id,
            _source: i
        };
        id += 1;
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
                connection: 'default',
                plugins: {
                    alert_api: {
                        watch_index: 'watches-v1',
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

    it('should return all the logged in users watches', async () => {
        searchResponse = fullESResponse(watches);
        const requestData = {
            query: `query getWatch {
                getWatch {
                    id
                    name
                    watch_type
                    actions{
                        action_type
                        message
                    }
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };

        const result = await got.post(url, options);
        expect(result.body.data.getWatch.length).toBe(4);
    });

    it('should create a proper es search for rules with watch_type: EXPRESSION', async () => {
        searchResponse = fullESResponse(watches);
        const requestData = {
            query: `query getWatch {
                getWatch(
                    watchProperties:{
                        watch_type: EXPRESSION 
                    }
                ) {
                    name
                    watch_type
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND watch_type: EXPRESSION');
    });

    it('should create proper es search for rules with specific action_types', async () => {
        searchResponse = fullESResponse(watches);
        const requestData = {
            query: `query getWatch {
                getWatch(
                    actionProperties: {
                        action_type: EMAIL
                    }
                ) {
                    name
                    actions {
                        action_type
                    }
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND actions.action_type: EMAIL');
    });

    it('should create search for rules with specific id', async () => {
        searchResponse = fullESResponse(watches);
        const requestData = {
            query: `query getWatch {
                getWatch(
                    watchProperties: {
                        id: 1
                    }
                ) {
                    name
                    watch_type
                    actions {
                        action_type
                    }
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };

        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND _id: 1');
    });

    it('should create search for watches with many specific limiters', async () => {
        searchResponse = fullESResponse(watches);
        const requestData = {
            query: `query getWatch {
                getWatch(
                    watchProperties: {
                        id: 1
                        watch_type: FIELDMATCH
                    }
                    actionProperties: {
                        action_type: WEBHOOK
                    }
                ) {
                    name
                    watch_type
                    actions {
                        action_type
                    }
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };
        await got.post(url, options);
        expect(searchQuery.q).toEqual('user_id: 1 AND _id: 1 AND watch_type: FIELDMATCH AND actions.action_type: WEBHOOK');
    });

    it('should create new watches for a user', async () => {
        const requestData = {
            query: `mutation addWatch { 
                addWatch (
                    name: "MyWatch",
                    watch_type: EXPRESSION,
                    spaces: ["space1"]
                    criteria: "ip: 1234"
                    alert_cycle: {
                        alert_every_watch_hit: true
                    }
                    actions: [
                        {
                            action_type: EMAIL
                            to: ["joe@joe.com", "bob@bob.com"]
                            from: "joe@joe.com"
                            subject: "my subject"
                            message: "this is a message"
                        }
                    ]
                )
                {
                    id
                    success
                    message
                }
            }`
        };
        const options = {
            json: true,
            body: requestData
        };
        try {
            const response = await got.post(url, options);
            // es index query should reflect whats in the graphql addRull query
            expect(indexQuery).toEqual({
                index: 'watches-v1',
                type: 'watch',
                id: indexQuery.id,
                body: {
                    name: 'MyWatch',
                    spaces: ['space1'],
                    watch_type: 'EXPRESSION',
                    criteria: 'ip: 1234',
                    alert_cycle: {
                        alert_every_watch_hit: true
                    },
                    actions: [
                        {
                            action_type: 'EMAIL',
                            to: ['joe@joe.com', 'bob@bob.com'],
                            from: 'joe@joe.com',
                            subject: 'my subject',
                            message: 'this is a message'
                        }
                    ],
                    user_id: '1'
                }
            });
            // check response
            expect(response.body.data.addWatch).toEqual({
                id: indexQuery.id,
                success: true,
                message: `New watch with id ${indexQuery.id} was created`
            });
        } catch (e) {
            fail(e);
        }
    });
});
