'use strict';

module.exports = (config) => {
    const { app, context, logger } = config;
    const esQueries = require('./esQueries')(context);
    const validate = require('./validate')(context, logger);

    const url = '/api/v1/alerts';

    app.route(`${url}/watch`)
        .get(async (req, res) => {
            const userId = req.user.id;
            const terms = `user_id: ${userId}`;
            try {
                const result = await esQueries.search(terms);
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
            const validRule = await validate.validateWatch(fields, true);
            if (validRule.isValid === false) {
                res.status(500).json({
                    error: 'Error, invalid fields in new watch',
                    reasons: validRule.invalidReasons
                });
                return;
            }
            try {
                const result = await esQueries.newWatch('rules-v1', 'rule', fields);
                if (!result.created) {
                    res.status(500).json({ error: 'a new watch could not be created' });
                    return;
                }
                res.json({ message: 'created new watch' });
            } catch (e) {
                logger.error(e);
                res.status(500).json({ error: 'Error, a new watch was not created' });
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
                const result = await esQueries.deleteWatch(fields.id);
                if (result.result === 'deleted') {
                    res.send({ message: `Watch ${fields.id} was deleted` });
                    return;
                }
                res.status(500)
                    .json({ message: `Could not delete ${fields.id}, check the uuid/ watch list and try again` });
            } catch (e) {
                logger.error(e);
                if (e.message === 'Not Found') {
                    res.send({ error: `Could not find watch with uuid: ${fields.id}` });
                } else {
                    res.status(500).json({ error: 'Server Error, could not delete the rule' });
                }
            }
        });
};

