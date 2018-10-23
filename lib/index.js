'use strict';

const { ApolloServer, gql } = require('apollo-server-express');
const _ = require('lodash');

module.exports = (config) => {
    const { app } = config;
    // const { logger } = config;
    const esQueries = require('./esQueries')(config.context);

    const typeDefs = gql`
        enum WatchType {
            EXPRESSION
            GEO
            FIELDMATCH
        }

        enum ActionType {
            EMAIL
            WEBHOOK
        }

        type Action {
            action_type: ActionType!
            url: String
            to: [String!]
        }

        type Rule {
            id: ID!
            name: String!
            watch_type: WatchType!
            criteria: String!
            actions: [Action!]!
        }

        type Query {
            getRules(watchType: WatchType, actionType: ActionType): [Rule!]
        }

        input AddAction {
            action_type: ActionType!
            url: String
            to: [String!]
        }

        type AddRuleResponse {
            success: Boolean!
            uuid: ID!
            criteria: String!
        }

        type Mutation {
            addRule(
                name: String!
                watch_type: WatchType!
                criteria: String!
                actions: [AddAction!]!
            ): AddRuleResponse
        }
`;

    function filterOnValue(dataArray, field, value) {
        return dataArray.filter(doc => doc[field] === value);
    }

    const resolvers = {
        Query: {
            // need to add a query by rule id
            getRules: async (obj, args, context) => {
                const index = 'rules-v1';
                const type = 'rule';
                const esResult = await esQueries.search(index, type, `user_id: ${context.user_id}`);
                let rules = esResult.hits.hits.map(rule => rule._source);
                if (args.watchType) {
                    rules = filterOnValue(rules, 'watch_type', args.watchType);
                }
                // return if rule has any actions of a certain type
                if (args.actionType) {
                    rules = rules.filter((rule) => {
                        if (rule.actions.some(action => action.action_type === args.actionType)) {
                            return true;
                        }
                        return false;
                    });
                }
                return rules;
            }
        },
        Mutation: {
            addRule: async (obj, args, context) => {
                const fields = _.keys(args).reduce((fieldObject, key) => {
                    fieldObject[key] = args[key];
                    return fieldObject;
                }, {});
                fields.user_id = context.user_id;
                // need to add validation step here
                const esResult = await esQueries.newRule('rules-v1', 'rule', fields);
                if (esResult.created === true) {
                    return esResult._id;
                }
            }
        }
    };

    const server = new ApolloServer({
        typeDefs,
        resolvers,
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
