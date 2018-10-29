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
        Query: () => new MockList(1),
        Action: () => ({
            action_type: 'EMAIL',
            subject: 'This is a subject',
            to: ['joe@joe.com']
        })
    }
});

fdescribe('graphql schema', () => {
    fit('should be of the correct type', async () => {
        // will fail if schema is incorrect
        const MockServer = mockServer(typeDefs);
        try {
            await MockServer.query('{ __schema { types { name } } }');
        } catch (e) {
            fail(e);
        }
    });

    fit('get ', async () => {
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

        const result = await graphql(schema, query);
        console.log(result);
    });
    // view rules by date, user, type, reset_criteria, name, with specifiec action properties
    // create new rule
    // update rule
    // delete rule
});
