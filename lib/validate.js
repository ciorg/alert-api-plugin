'use strict';

const _ = require('lodash');

module.exports = (context, logger) => {
    const esQueries = require('./esQueries')(context);
    async function _uniqField(field, value) {
        try {
            const result = await esQueries.search(`${field}: ${value}`);
            if (result.hits.total > 0) return false;
            return true;
        } catch (e) {
            // TODO: figure out what to do with this error
            logger.error(e);
            return e.message;
        }
    }

    const validWatch = {
        isValid: true,
        invalidReasons: []
    };

    const _actionValidationFunctions = {
        email: (action) => {
            // action fields
            const {
                subject, from, to, body, ffrom
            } = action;
            // must be defined - subject, to, from
            if ([subject, to, from].some(i => i === undefined)) {
                _invalidReason('the email action\'s subject, to, or from field is missing');
            }
            // subject, from must be strings
            if ([subject, from].some(i => typeof i !== 'string')) {
                _invalidReason('the email action\'s subject and from must be a string');
            }

            // if body/ffrom is present it must be a string
            if (body && typeof body !== 'string') {
                _invalidReason('email body must be a string');
            }

            if (ffrom && typeof ffrom !== 'string') {
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
        if (!action.action_type) {
            _invalidReason('Each action must specify an action_type');
            return;
        }
        const actionType = action.action_type.toLowerCase();
        _actionValidationFunctions[actionType](action);
    }

    function _invalidReason(message) {
        validWatch.isValid = false;
        validWatch.invalidReasons.push(message);
    }

    async function validateWatch(fields, newWatch) {
        validWatch.isValid = true;
        validWatch.invalidReasons = [];
        // name should be defined
        if (!fields.name) {
            _invalidReason('Watch name is missing');
        }
        // not sure how spaces will be handled
        if (!fields.spaces) {
            _invalidReason('Please assign a space to the watch');
        }
        // name should be uniq if a new Watch
        if (newWatch && !await _uniqField('name', fields.name)) {
            _invalidReason('New watch name has already been used');
        }
        // watch_type - can only contain field, expression, or geo
        if (['fieldmatch', 'geo', 'expression'].indexOf(fields.watch_type.toLowerCase()) === -1) {
            _invalidReason('watch_type must be fieldmatch, geo, or expression');
        }
        // criteria - needs to exist, other function later on will check if it's valid
        if (!fields.criteria || typeof fields.criteria !== 'string') {
            _invalidReason('criteria must exist and be a string');
        }
        // if include_record, must be a boolean, defaults to false
        if (fields.include_record && typeof fields.include_record !== 'boolean') {
            _invalidReason('include_record should be true or false');
        }
        // must be an array of fields, defaults to empty which is every field
        if (fields.record_fields && !_.isArray(fields.record_fields)) {
            _invalidReason('record_fields should be an array of fields');
        }
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
            _invalidReason('Watch must have actions');
        }
        // each action must be validated according to it's type
        if (fields.actions) fields.actions.forEach(action => _validateAction(action));
        return validWatch;
    }

    return {
        _uniqField,
        validateWatch
    };
};
