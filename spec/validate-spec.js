'use strict';

const _ = require('lodash');

let searchError = false;
let searchResult;

const context = {
    sysconfig: {
        teraserver: {
            connection: 'default',
            plugins: {
                alert_api: {
                    watch_index: 'watch-v1',
                    watch_type: 'watch'
                }
            }
        },
    },
    foundation: {
        getConnection: () => ({
            client: {
                search: () => {
                    if (searchError) return Promise.reject(new Error('this is an error'));
                    return Promise.resolve(searchResult);
                }
            }
        })
    }
};

const logger = {
    error: () => {}
};

const validate = require('../lib/validate')(context, logger);

const fields = {
    name: 'watch1',
    uuid: '1234',
    watch_type: 'EXPRESSION',
    spaces: 'space1',
    user_id: 'u123',
    criteria: 'name: joe',
    alert_message: 'do something',
    include_record: true,
    record_fields: ['name', 'ip'],
    reset_criteria: {
        alert_count: 10,
        reset_count: 30,
        reset_units: 'min'
    },
    actions: [
        {
            action_type: 'email',
            to: 'you@name.com',
            from: 'me@name.com',
            body: 'more info',
            subject: 'email subject'
        },
        {
            action_type: 'webhook',
            url: 'this.is.the.url.io',
            message: 'this is an alert',
            token: 'thisisatoken'
        }
    ]
};

describe('validate', () => {
    it('should return true if a uniq Value', async () => {
        searchResult = {
            hits: {
                total: 0
            }
        };
        const result = await validate._uniqField('name', 'watch1');
        expect(result).toBe(true);
    });

    it('should return false if not uniq', async () => {
        searchResult = {
            hits: {
                total: 23
            }
        };
        const result = await validate._uniqField('name', 'watch1');
        expect(result).toBe(false);
    });

    it('should return search error if there is an error', async () => {
        searchResult = {
            hits: {
                total: 23
            }
        };
        searchError = true;
        const result = await validate._uniqField('name', 'watch1');
        expect(result).toBe('this is an error');
        searchError = false;
    });

    it('should validate that all fields are present for a watch to be valid', async () => {
        searchResult = {
            hits: {
                total: 0
            }
        };

        try {
            const result = await validate.validateWatch(fields, true);
            expect(result.isValid).toBe(true);
            expect(result.invalidReasons.length).toBe(0);
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if name is not defined', async () => {
        searchResult = {
            hits: {
                total: 0
            }
        };

        const testFields = _.cloneDeep(fields);
        delete testFields.name;

        try {
            const result = await validate.validateWatch(testFields, true);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('Watch name is missing');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if spaces is not definded', async () => {
        searchResult = {
            hits: {
                total: 0
            }
        };

        const testFields = _.cloneDeep(fields);
        delete testFields.spaces;

        try {
            const result = await validate.validateWatch(testFields, true);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('Please assign a space to the watch');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if name is not uniq or undefined', async () => {
        searchResult = {
            hits: {
                total: 3
            }
        };

        const testFields = _.cloneDeep(fields);

        try {
            const result = await validate.validateWatch(testFields, true);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('New watch name has already been used');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if watch_type is not geo, expression, or field', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.watch_type = 'bluewhale';

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('watch_type must be fieldmatch, geo, or expression');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if criteria is missing', async () => {
        const testFields = _.cloneDeep(fields);
        delete testFields.criteria;
        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('criteria must exist and be a string');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if criteria is wrong format', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.criteria = true;
        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('criteria must exist and be a string');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if include record is wrong format', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.include_record = 'true';
        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('include_record should be true or false');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if include record is wrong format', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.record_fields = {
            field1: 'someField'
        };

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('record_fields should be an array of fields');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if reset_criteria does not have all the properties', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.reset_criteria = {
            alert_count: 5,
            reset_count: 10
        };

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('alert reset should have alert_count, reset_count, reset_units');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if actions are missing or no actions', async () => {
        const testFields = _.cloneDeep(fields);
        delete testFields.actions;

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('Watch must have actions');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if actions are missing or no actions', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.actions = [];

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('Watch must have actions');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if emails actions are missing key properties', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.actions = [
            {
                action_type: 'email',
                from: 'me@name.com',
                body: 'more info',
            }
        ];

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(2);
            expect(result.invalidReasons[0]).toBe('the email action\'s subject, to, or from field is missing');
            expect(result.invalidReasons[1]).toBe('the email action\'s subject and from must be a string');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if emails actions to and from addresses are a bad format', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.actions = [
            {
                action_type: 'email',
                from: 'myemailasdfqewopf',
                to: ['go@go.com@go.com', 'bob@bob.com'],
                body: 'more info',
                subject: 'this is the subject'
            }
        ];

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('email from and to addresses must have a valid format');
        } catch (e) {
            fail(e);
        }
    });

    it('should be able to handle multiple email addresses', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.actions = [
            {
                action_type: 'email',
                from: 'me@me.com',
                to: ['roy@go.com', 'bob@bob.com', 'clem@go.com'],
                body: 'more info',
                subject: 'this is the subject'
            }
        ];

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(true);
            expect(result.invalidReasons.length).toBe(0);
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid if webhook action is missing key properties', async () => {
        const testFields = _.cloneDeep(fields);
        testFields.actions = [
            {
                action_type: 'webhook',
                url: 'this.is.the.url.io',
                message: 'this is an alert'
            }
        ];

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(1);
            expect(result.invalidReasons[0]).toBe('webhook url, token, and message must be defined');
        } catch (e) {
            fail(e);
        }
    });

    it('should mark watch invalid for many reasons', async () => {
        const testFields = _.cloneDeep(fields);
        delete testFields.name;
        delete testFields.spaces;
        delete testFields.criteria;
        testFields.include_record = 'please do';
        testFields.actions[0].from = 'nowayjose';
        delete testFields.actions[0].subject;
        delete testFields.actions[1].url;

        try {
            const result = await validate.validateWatch(testFields);
            expect(result.isValid).toBe(false);
            expect(result.invalidReasons.length).toBe(8);
        } catch (e) {
            fail(e);
        }
    });
});
