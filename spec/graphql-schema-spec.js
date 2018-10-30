'use strict';

const {
    makeExecutableSchema,
    addMockFunctionsToSchema,
    mockServer,
    MockList
} = require('graphql-tools');
const { graphql } = require('graphql');
const uuid = require('uuid/v4');

const typeDefs = require('../lib/schema');
const resolvers = require('../lib/resolvers');

const schema = makeExecutableSchema({
    typeDefs,
    typeResolvers: resolvers
});

const newId = uuid();

addMockFunctionsToSchema({
    schema,
    mocks: {
        Boolean: () => false,
        ID: () => uuid(),
        WatchType: () => 'EXPRESSION',
        Query: () => ({
            getWatch: () => new MockList(1)
        }),
        Watch: () => ({
            id: () => newId,
            name: () => 'testWatch',
            spaces: () => ['space1', 'space2'],
            criteria: () => 'ip: 1234 AND name: whogoesthere',
            include_record: () => true,
            record_fields: () => ['name', 'ip'],
            actions: () => new MockList(2)
        }),
        Action: () => ({
            action_type: 'EMAIL',
            message: 'this is an alert',
            subject: 'This is a subject',
            to: ['joe@joe.com', 'bob@joe.com'],
            from: 'alert@alerts.com',
            ffrom: 'serious alert',
            url: 'send.io/alert/here',
            token: 'supersecretToken'
        }),
        AlertCycle: () => ({
            alert_every_watch_hit: () => false,
            alert_on_watch_count: () => 100,
            alert_on_time_count: () => 15,
            time_units: () => 'MINUTES'
        }),
        MutateWatchResponse: () => ({
            success: () => true
        })
    }
});

describe('graphql schema', () => {
    it('should be of the correct type', async () => {
        // will fail if schema has type errors
        const MockServer = mockServer(typeDefs);
        try {
            await MockServer.query('{ __schema { types { name } } }');
        } catch (e) {
            fail(e);
        }
    });

    it('getWatchs should return all properties of a Watch', async () => {
        const query = `
            query getWatch {
                getWatch {
                    id
                    name
                    spaces
                    watch_type
                    criteria
                    include_record
                    record_fields
                    alert_cycle {
                        alert_every_watch_hit
                        alert_on_watch_count
                        alert_on_time_count
                        time_units
                    }
                    actions {
                        action_type
                        message
                        subject
                        to
                        bcc
                        from
                        ffrom
                        token
                        url
                    }
                }
            }
        `;

        try {
            const result = await graphql(schema, query);
            // all fields shoule be defined and have legit values
            const returnData = result.data.getWatch[0];
            expect(returnData.id).toBe(newId);
            expect(returnData.name).toBe('testWatch');
            expect(returnData.spaces).toEqual(['space1', 'space2']);
            expect(returnData.criteria).toBe('ip: 1234 AND name: whogoesthere');
            expect(returnData.include_record).toBe(true);
            expect(returnData.record_fields).toEqual(['name', 'ip']);
            // alert_cycle properties
            const alertCycle = returnData.alert_cycle;
            expect(alertCycle.alert_every_watch_hit).toBe(false);
            expect(alertCycle.alert_on_watch_count).toBe(100);
            expect(alertCycle.alert_on_time_count).toBe(15);
            expect(alertCycle.time_units).toBe('MINUTES');
            // actions properties
            const { actions } = returnData;
            expect(actions.length).toBe(2);
            expect(actions[0].action_type).toBe('EMAIL');
            expect(actions[0].message).toBe('this is an alert');
            expect(actions[0].subject).toBe('This is a subject');
            expect(actions[0].from).toBe('alert@alerts.com');
            expect(actions[0].to).toEqual(['joe@joe.com', 'bob@joe.com']);
            expect(actions[0].ffrom).toBe('serious alert');
            expect(actions[0].url).toBe('send.io/alert/here');
            expect(actions[0].token).toBe('supersecretToken');
        } catch (e) {
            fail(e);
        }
    });

    it('query getWatch should accept watchProperties and actionProperties arguments', async () => {
        const query = `
            query getWatch {
                getWatch (
                    watchProperties: {
                        id: "${newId}"
                        name: "testWatch"
                        spaces: "space1"
                        watch_type: EXPRESSION
                        include_record: false
                        alert_cycle: {
                            alert_every_watch_hit: false
                            alert_on_watch_count: 15
                            alert_on_time_count: 15
                            time_units: MINUTES
                        }
                    }
                    actionProperties: {
                        action_type: WEBHOOK
                        url: "thisisaurl"
                        token: "somesecretToken"
                        to: "bob@bob.com"
                        from: "alert@alert.com"
                        subject: "subject"
                        ffrom: "from stuff"
                        message: "this is a message"
                    }
                ) {
                    id
                    name
                    spaces
                    watch_type
                    criteria
                    include_record
                    record_fields
                    alert_cycle {
                        alert_every_watch_hit
                        alert_on_watch_count
                        alert_on_time_count
                        time_units
                    }
                    actions {
                        action_type
                        message
                        subject
                        to
                        bcc
                        from
                        ffrom
                        token
                        url
                    }
                }
            }
        `;
        try {
            const result = await graphql(schema, query);
            expect(result.data.getWatch.length).toBe(1);
        } catch (e) {
            fail(e);
        }
    });

    it('should accept addWatch mutatation query', async () => {
        const query = `
            mutation addWatch {
                addWatch(
                    name: "newWatch"
                    spaces: ["space1", "space2"]
                    watch_type: EXPRESSION
                    criteria: "ip: ipaddress"
                    include_record: true
                    record_fields: ["ip"]
                    alert_cycle: {
                        alert_every_watch_hit: true
                    }
                    actions: {
                        action_type: WEBHOOK
                        url: "someurl"
                        token: "sometoken"
                    }

                ){
                    id
                    message
                    success
                    watch {
                        name
                        criteria
                        include_record
                        record_fields
                        alert_cycle {
                            alert_every_watch_hit
                        }
                        actions {
                            action_type
                            url
                            token
                        }
                    }
                }
            }
        `;

        try {
            const result = await graphql(schema, query);
            if (result.errors) fail(result.errors);
            expect(result.data.addWatch.id).toBeDefined();
            expect(result.data.addWatch.success).toBe(true);
            expect(result.data.addWatch.message).toBeDefined();
            expect(result.data.addWatch.watch.name).toBeDefined();
        } catch (e) {
            fail(e);
        }
    });

    it('should accept deleteWatch mutation query', async () => {
        const query = `
            mutation deleteWatch {
                deleteWatch(
                    id: "${newId}"
                ){
                    id
                    success
                    message
                }
            }
        `;

        try {
            const result = await graphql(schema, query);
            if (result.errors) fail(result.errors);
            expect(result.data.deleteWatch.success).toBe(true);
        } catch (e) {
            fail(e);
        }
    });

    it('should accept editWath mutation query', async () => {
        const query = `
            mutation editWatch {
                editWatch(
                    id: "${newId}"
                    name: "newName"
                    include_record: true
                    record_fields: ["ip", "name"]
                ){
                    id
                    success
                    message
                }
            }
        `;

        try {
            const result = await graphql(schema, query);
            if (result.errors) fail(result.errors);
            expect(result.data.editWatch.success).toBe(true);
        } catch (e) {
            fail(e);
        }
    });
});
