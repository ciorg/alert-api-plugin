'use strict';

const express = require('express');
const http = require('http');
const _ = require('lodash');
const bodyParser = require('body-parser');

const addUserId = function (req, res, next) {
    _.set(req, 'user.id', '1');
    next();
};

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
            },
        },
        foundation: {
            getConnection: () => ({
                client: {
                    search: () => Promise.resolve('index endpoint'),
                    delete: () => Promise.resolve('delete endpoint'),
                    update: () => Promise.resolve('update endpoint'),
                    index: () => Promise.resolve('index endpoint')
                }
            })
        }
    }
};


const app = express();
app.use(bodyParser.json());
app.use(addUserId);
config.app = app;

// add graphql middleware
require('../lib')(config);

// start server with http to enble the kill switch
const server = http.createServer(app);
server.listen(3000, () => console.log('server is up on 3000'));
