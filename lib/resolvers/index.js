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
            getRules: async (obj, args, graphContext) => {
                const index = 'rules-v1';
                const type = 'rule';
                let search = `user_id: ${graphContext.user_id}`;
                const ruleProps = args.ruleProperties;
                const actionProps = args.actionProperties;

                if (ruleProps) {
                    _.keys(ruleProps).forEach((key) => {
                        const field = key === 'id' ? '_id' : key;
                        const value = ruleProps[field];
                        if (_.isPlainObject(value)) {
                            _.keys(value).forEach((innerKey) => {
                                const newField = `${field}.${innerKey}`;
                                const newValue = value[innerKey];
                                search += ruleFitlerForESQuery(newField, newValue);
                            });
                        } else {
                            search += ruleFitlerForESQuery(field, value);
                        }
                    });
                }

                if (actionProps) {
                    _.keys(actionProps).forEach((key) => {
                        search += ruleFitlerForESQuery(`actions.${key}`, actionProps[key]);
                    });
                }
                try {
                    const esResult = await esQueries.search(index, type, search);
                    return esResult.hits.hits.map((rule) => {
                        const ruleData = rule._source;
                        ruleData.id = rule._id;
                        return ruleData;
                    });
                } catch (e) {
                    return {
                        success: false,
                        message: e.message
                    };
                }
            }
        },
        Mutation: {
            addRule: async (obj, args, graphContext) => {
                const fields = _.cloneDeep(args);
                fields.user_id = graphContext.user_id;
                // validate rule
                try {
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
                        id: esResult._id,
                        message
                    };
                } catch (e) {
                    return {
                        success: false,
                        message: e.message
                    };
                }
            },
            deleteRule: async (obj, args) => {
                try {
                    const result = await esQueries.deleteRecord('rules-v1', 'rule', args.id);
                    if (!result.found || !result.result === 'deleted') {
                        return {
                            success: false,
                            message: `Rule ${args.id} could not be deleted`
                        };
                    }
                    return {
                        success: true,
                        message: `Rule ${args.id} was deleted`,
                        id: args.id
                    };
                } catch (e) {
                    return {
                        success: false,
                        message: e.message
                    };
                }
            },
            editRule: async (obj, args, graphContext) => {
                const fields = _.cloneDeep(args);
                fields.user_id = graphContext.user_id;
                try {
                    const result = await esQueries.updateRule('rules-v1', 'rule', fields);
                    if (!result.result === 'updated') {
                        return {
                            success: false,
                            message: `Rule ${fields.id} was not updated`
                        };
                    }
                    return {
                        success: true,
                        message: `Rule ${args.id} was updated`,
                        id: args.id
                    };
                } catch (e) {
                    return {
                        success: false,
                        message: e.message
                    };
                }
            }
        }
    };

    return {
        resolvers
    };
};
