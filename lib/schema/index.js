'use strict';

const { gql } = require('apollo-server-express');

module.exports = gql`
    enum WatchType {
        EXPRESSION
        GEO
        FIELDMATCH
    }

    enum ActionType {
        EMAIL
        WEBHOOK
    }

    enum TimeUnits {
        MINUTES
        HOURS
        DAYS
    }

    interface Action {
        action_type: ActionType!
        message: String
    }

    type Email implements Action {
        action_type: ActionType!
        message: String
        to: [String!]
        bcc: [String!]
        from: String
        ffrom: String
        subject: String
    }

    type Webhook implements Action {
        action_type: ActionType!
        message: String
        url: String
        token: String
    }

    type AlertCycle {
        alert_every_watch_hit: Boolean
        alert_on_watch_count: Int
        alert_on_time_count: Int
        time_units: TimeUnits
    }

    type Watch {
        id: ID!
        spaces: [String!]!
        name: String!
        watch_type: WatchType!
        criteria: String!
        # optional to include record in alert message
        include_record: Boolean
        record_fields: [String!]
        alert_cycle: AlertCycle
        actions: [Action!]!
    }

    input ActionProperties {
        action_type: ActionType
        message: String
        to: [String!]
        bcc: [String!]
        from: String
        ffrom: String
        subject: String
        url: String
        token: String
    }

    input WatchProperties {
        id: ID
        name: String
        spaces: [String!]
        watch_type: WatchType
        alert_cycle: InputAlertCycle
        include_record: Boolean
    }

    type Query {
            getWatch(
                watchProperties: WatchProperties
                actionProperties: ActionProperties
            ): [Watch!]
        }

    input AddAction {
        # general action properties
        action_type: ActionType!
        message: String
        # properties for webhook
        url: String
        token: String
        # properties for email
        to: [String!]
        bcc: [String!]
        from: String
        ffrom: String
        subject: String
    }

    input InputAlertCycle {
        alert_every_watch_hit: Boolean
        alert_on_watch_count: Int
        alert_on_time_count: Int
        time_units: TimeUnits
    }

    type MutateWatchResponse {
        success: Boolean!
        message: String
        id: ID
        watch: Watch
    }

    type Mutation {
        addWatch(
            name: String!
            spaces: [String!]!
            watch_type: WatchType!
            criteria: String!
            actions: [AddAction!]!
            include_record: Boolean
            record_fields: [String!]
            alert_cycle: InputAlertCycle!
        ): MutateWatchResponse

        deleteWatch(
            id: ID!
        ): MutateWatchResponse

        editWatch(
            id: ID!
            name: String
            watch_type: WatchType
            criteria: String
            include_record: Boolean
            record_fields: [String!]
            alert_cycle: InputAlertCycle
            actions: [AddAction!]
        ): MutateWatchResponse
    }
`;
