'use strict';

module.exports = (config) => {
    const { app } = config;
    const { logger } = config;
    const { context } = config;
    const esQueries = require('./esQueries')(context);
    const validate = require('./validate')(context, logger);

    const url = `${config.url_base}/v1`;

    app.route(`${url}/rules/:user_id`)
        .get(async (req, res) => {
            const userId = req.params.user_id;
            const terms = `user_id: ${userId}`;
            try {
                const result = await esQueries.search('rules-v1', 'rule', terms);
                res.send(result.hits.hits);
            } catch (e) {
                logger.error(e);
                res.status(500).send(e);
            }
        })
        .post(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.params.user_id;
            // new rule needs to 2 paramaters
            const validRule = await validate.validateRule(fields, true);
            if (!validRule.isValid) {
                res.status(500).send(validRule.invalidReasons);
                return;
            }
            try {
                const result = await esQueries.newRule('rules-v1', 'rule', fields);
                if (!result.created) {
                    res.status(500).send('a new record was not created');
                    return;
                }
                res.send('created new rule');
            } catch (e) {
                logger.error(e);
                res.status(500).send('something went wrong, a new record was not created');
            }
        })
        .put(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.params.user_id;
            const validRule = await validate.validateRule(fields);
            if (!validRule.isValid) {
                res.status(500).send(validRule.invalidReasons);
                return;
            }
            try {
                const result = await esQueries.updateRule('rules-v1', 'rule', fields);
                res.send(result);
            } catch (e) {
                logger.error(e);
                res.status(500).send(e);
            }
        })
        .delete(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.params.user_id;
            try {
                await esQueries.deleteRecord('rules-v1', 'rule', fields);
                res.send('rule was deleted');
            } catch (e) {
                logger.error(e);
                res.status(500).send('something went wrong, the rule was not deleted');
            }
        });
};

