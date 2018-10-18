'use strict';

module.exports = (config) => {
    const { app } = config;
    const { logger } = config;
    const { context } = config;
    const esQueries = require('./esQueries')(context);
    const validate = require('./validate')(context, logger);

    const url = '/api/v1/alerts';

    app.route(`${url}/rules`)
        .get(async (req, res) => {
            const userId = req.user.id;
            const terms = `user_id: ${userId}`;
            try {
                const result = await esQueries.search('rules-v1', 'rule', terms);
                res.send(result.hits.hits);
            } catch (e) {
                logger.error(e);
                res.status(500).json({ error: 'could not retreive rules' });
            }
        })
        .post(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.user.id;
            // specify new rule with true in 2nd parameter
            const validRule = await validate.validateRule(fields, true);
            if (validRule.isValid === false) {
                res.status(500).json({
                    error: 'Error, invalid fields in new rule',
                    reasons: validRule.invalidReasons
                });
            }
            try {
                const result = await esQueries.newRule('rules-v1', 'rule', fields);
                if (!result.created) {
                    res.status(500).json({ error: 'a new record could not be created' });
                    return;
                }
                res.json({ message: 'created new rule' });
            } catch (e) {
                logger.error(e);
                res.status(500).json({ error: 'Error, a new record was not created' });
            }
        })
        .put(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.user.id;
            const validRule = await validate.validateRule(fields);
            if (!validRule.isValid) {
                res.status(500).json({
                    error: 'Error, invalid fields in updated rule',
                    reasons: validRule.invalidReasons
                });
                return;
            }
            try {
                const result = await esQueries.updateRule('rules-v1', 'rule', fields);
                res.send(result);
            } catch (e) {
                logger.error(e);
                res.status(500).json({ error: 'Server Error: rule could not be updated' });
            }
        })
        .delete(async (req, res) => {
            const fields = req.body;
            fields.user_id = req.user.id;
            try {
                const result = await esQueries.deleteRecord('rules-v1', 'rule', fields);
                if (result.result === 'deleted') {
                    res.send({ message: `rule ${fields.uuid} was deleted` });
                    return;
                }
                res.json({ message: `Could not delete ${fields.uuid}, check the uuid/ rules list and try again` });
            } catch (e) {
                logger.error(e);
                if (e.message === 'Not Found') {
                    res.json({ error: `Could not find rule with uuid: ${fields.uuid}` });
                } else {
                    res.status(500).json({ error: 'Server Error, could not delete the rule' });
                }
            }
        });
};

