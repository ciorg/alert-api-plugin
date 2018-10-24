'use strict';

const _ = require('lodash');

module.exports = (config) => {
    const { context, logger } = config;
    const esQueries = require('../esQueries')(context);
    const validate = require('../validate')(context, logger);

    function ruleFitlerForESQuery(esField, value) {
        return ` AND ${esField}: ${value}`;
    }

    const resolvers = {
        Query: {
            // other properties to filter by
            // created date
            // name
            // space
            // action fields, to, from, subject, bcc, message
            // currently searches by logged in user
            getRules: async (obj, args, graphContext) => {
                const index = 'rules-v1';
                const type = 'rule';
                let search = `user_id: ${graphContext.user_id}`;
                // by rule id
                if (args.id) {
                    search += ruleFitlerForESQuery('_id', args.id);
                }
                // by watchType
                if (args.watchType) {
                    search += ruleFitlerForESQuery('watch_type', args.watchType);
                }
                // by actionType
                if (args.actionType) {
                    search += ruleFitlerForESQuery('actions.action_type', args.actionType);
                }
                const esResult = await esQueries.search(index, type, search);
                return esResult.hits.hits.map(rule => rule._source);
            }
        },
        Mutation: {
            addRule: async (obj, args, graphContext) => {
                const fields = _.keys(args).reduce((fieldObject, key) => {
                    fieldObject[key] = args[key];
                    return fieldObject;
                }, {});
                fields.user_id = graphContext.user_id;
                // validate rule
                const validRule = await validate.validateRule(fields, true);
                if (!validRule.isValid) {
                    return {
                        success: false,
                        message: validRule.invalidReasons.join(', ')
                    };
                }
                const esResult = await esQueries.newRule('rules-v1', 'rule', fields);
                const message = esResult.created ? 'New rule was created' : 'Rule was not created';
                return {
                    success: esResult.created,
                    uuid: esResult._id,
                    message
                };
            },
            deleteRule: async () => {},
            editRule: async () => {}
        }
    };

    return {
        resolvers
    };
};
