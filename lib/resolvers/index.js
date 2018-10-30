'use strict';

const _ = require('lodash');

module.exports = (config) => {
    // console.log(config.context.sysconfig.teraserver);
    const { context, logger } = config;
    const esQueries = require('../esQueries')(context);
    const validate = require('../validate')(context, logger);

    function _watchFitlerForESQuery(esField, value) {
        return ` AND ${esField}: ${value}`;
    }

    const resolvers = {
        Query: {
            getWatch: async (obj, args, graphContext) => {
                let search = `user_id: ${graphContext.user_id}`;
                const watchProps = args.watchProperties;
                const actionProps = args.actionProperties;

                if (watchProps) {
                    _.keys(watchProps).forEach((key) => {
                        const field = key === 'id' ? '_id' : key;
                        const value = watchProps[field];
                        if (_.isPlainObject(value)) {
                            _.keys(value).forEach((innerKey) => {
                                const newField = `${field}.${innerKey}`;
                                const newValue = value[innerKey];
                                search += _watchFitlerForESQuery(newField, newValue);
                            });
                        } else {
                            search += _watchFitlerForESQuery(field, value);
                        }
                    });
                }

                if (actionProps) {
                    _.keys(actionProps).forEach((key) => {
                        search += _watchFitlerForESQuery(`actions.${key}`, actionProps[key]);
                    });
                }
                try {
                    const esResult = await esQueries.search(search);
                    return esResult.hits.hits.map((watch) => {
                        const watchData = watch._source;
                        watchData.id = watch._id;
                        return watchData;
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
            addWatch: async (obj, args, graphContext) => {
                const fields = _.cloneDeep(args);
                fields.user_id = graphContext.user_id;
                // validate watch
                try {
                    const validWatch = await validate.validateWatch(fields, true);
                    if (!validWatch.isValid) {
                        return {
                            success: false,
                            message: validWatch.invalidReasons.join(', ')
                        };
                    }
                    const esResult = await esQueries.newWatch(fields);
                    let message = `New watch with id ${esResult._id} was created`;
                    if (!esResult.created) {
                        message = 'New watch was not created';
                    }
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
            deleteWatch: async (obj, args) => {
                try {
                    const result = await esQueries.deleteWatch(args.id);
                    if (!result.found || result.result !== 'deleted') {
                        return {
                            success: false,
                            message: `Watch ${args.id} could not be deleted`
                        };
                    }
                    return {
                        success: true,
                        message: `Watch ${args.id} was deleted`,
                        id: args.id
                    };
                } catch (e) {
                    return {
                        success: false,
                        message: e.message
                    };
                }
            },
            editWatch: async (obj, args) => {
                // needs to validate the newly update watch
                const fields = _.cloneDeep(args);
                try {
                    const result = await esQueries.updateWatch(fields);
                    if (!result.result === 'updated') {
                        return {
                            success: false,
                            message: `Watch ${fields.id} was not updated`
                        };
                    }
                    return {
                        success: true,
                        message: `Watch ${args.id} was updated`,
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
