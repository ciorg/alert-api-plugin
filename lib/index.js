'use strict';

const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');

module.exports = (config) => {
    const { resolvers } = require('./resolvers')(config);
    const typeDefs = require('./schema');

    const { app } = config;

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers
    });

    const server = new ApolloServer({
        schema,
        context: ({ req }) => ({
            user_id: req.user.id
        }),
        playground: {
            settings: {
                'request.credentials': 'include'
            }
        }
    });

    server.applyMiddleware({
        app,
        path: '/api/v1/alerts-graphql'
    });
};
