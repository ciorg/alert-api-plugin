'use strict';

const {
    makeExecutableSchema,
    addMockFunctionsToSchema,
    mockServer,
    MockList
} = require('graphql-tools');
const { graphql } = require('graphql');

const typeDefs = require('../lib/schema');

const schema = makeExecutableSchema({
    typeDefs
});

addMockFunctionsToSchema({
    schema,
    mocks: {
        Boolean: () => false,
        String: () => 'bob',
        ID: () => 'bob1',
        WatchType: () => 'EXPRESSION',
        Rule: () => ({
            actions: () => new MockList([1, 10])
        }),
        Action: () => ({
            action_type: 'EMAIL',
            subject: 'This is a subject',
            to: ['joe@joe.com']
        })
    }
});

const query = `
    query getRules {
        getRules {
            id
            name
            watch_type
            criteria
            actions {
                action_type
                subject
                to
            }
        }
    }
`;

// const MockServer = mockServer(typeDefs);
// MockServer.query(`{ __schema { types { name } } }`).then(result => console.log(result.data.__schema.types));
graphql(schema, query).then(result => console.log('Got result', result.data.getRules[0]));

// test for queries 