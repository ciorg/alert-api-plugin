'use strict';

const _ = require('lodash');

module.exports = (context, logger) => {
    const esQueries = require('./esQueries')(context);
    async function _uniqField(index, type, field, value) {
        try {
            const result = await esQueries.search(index, type, `${field}: ${value}`);
            if (result.hits.total > 0) return false;
            return true;
        } catch (e) {
            // TODO: figure out what to do with this error
            logger.error(e);
            return e.message;
        }
    }

    const validRule = {
        isValid: true,
        invalidReasons: []
    };

    const _actionValidationFunctions = {
        email: (action) => {
            // action fields
            const {
                subject, from, to, body
            } = action;
            // must be defined - subject, to, from
            if ([subject, to, from].some(i => i === undefined)) {
                _invalidReason('the email action\'s subject, to, or from field is missing');
            }
            // subject, from must be strings
            if ([subject, from].some(i => typeof i !== 'string')) {
                _invalidReason('the email action\'s subject and from must be a string');
            }

            // if body is present it must be a string
            if (body && typeof body !== 'string') {
                _invalidReason('email body must be a string');
            }

            // email address fields should resemble an email address
            const emailRegex = new RegExp(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/, 'i');
            const emailAddresses = [];
            if (from) emailAddresses.push(from);
            // 'to' may have multiple email addresses
            if (to && _.isArray(to)) {
                to.forEach(emailAddress => emailAddresses.push(emailAddress));
            } else if (to) {
                emailAddresses.push(to);
            }
            if (emailAddresses.length &&
                emailAddresses.some(emailAddress => !emailRegex.test(emailAddress.trim()))) {
                _invalidReason('email from and to addresses must have a valid format');
            }
        },
        webhook: (action) => {
            // webhook fields url, token, message should all be defined and strings
            const {
                url, token, message
            } = action;

            if (![url, token, message].every(field => field && typeof field === 'string')) {
                _invalidReason('webhook url, token, and message must be defined');
            }
        }
    };

    function _validateAction(action) {
        const { type } = action;
        _actionValidationFunctions[type](action);
    }

    function _invalidReason(message) {
        validRule.isValid = false;
        validRule.invalidReasons.push(message);
    }

    async function validateRule(fields, newRule) {
        validRule.isValid = true;
        validRule.invalidReasons = [];
        // name should be defined
        if (!fields.name) {
            _invalidReason('Rule name is missing');
        }
        // not sure how spaces will be handled
        if (!fields.spaces) {
            _invalidReason('Please assign a space to the rule');
        }
        // name should be uniq if a new rule
        if (newRule && !await _uniqField('rules-v1', 'rule', 'name', fields.name)) {
            _invalidReason('New rule name has already been used');
        }
        // watch_type - can only contain field, expression, or geo
        if (['field', 'geo', 'expression'].indexOf(fields.watch_type) === -1) {
            _invalidReason('watch_type must be field, geo, or expression');
        }
        // criteria - needs to exist, other function later on will check if it's valid
        if (!fields.criteria || typeof fields.criteria !== 'string') {
            _invalidReason('criteria must exist and be a string');
        }
        // if include_record, must be a boolean, defaults to false
        if (fields.include_record && typeof fields.include_record !== 'boolean') {
            _invalidReason('include_record should be true or false');
        }
        if (!fields.include_record) fields.include_record = false;
        // must be an array of fields, defaults to empty which is every field
        if (fields.record_fields && !_.isArray(fields.record_fields)) {
            _invalidReason('record_fields should be an array of fields');
        }
        if (!fields.record_fields) fields.record_fields = [];
        // object with alert_count, reset_unit_amount and reset_units
        if (fields.reset_criteria &&
            (!_.has(fields.reset_criteria, 'alert_count')
            || !_.has(fields.reset_criteria, 'reset_count')
            || !_.has(fields.reset_criteria, 'reset_units'))
        ) {
            _invalidReason('alert reset should have alert_count, reset_count, reset_units');
        }
        // must have at least one action
        if (!fields.actions || fields.actions.length === 0) {
            _invalidReason('the rule must have actions');
        }
        // each action must be validated according to it's type
        if (fields.actions) fields.actions.forEach(action => _validateAction(action));
        return validRule;
    }

    return {
        _uniqField,
        validateRule
    };
};
