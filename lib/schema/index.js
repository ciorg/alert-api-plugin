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
        MINUTE
        HOUR
        DAY
    }

    type Action {
        # actions are verified by the action type
        action_type: ActionType!
        message: String
        # email action fields
        to: [String!]
        bcc: [String!]
        from: String
        ffrom: String
        subject: String
        # webhook action fields
        url: String
        token: String
    }

    type AlertOn {
        reset_count: Int
        time_count: Int
        time_units: TimeUnits
    }

    type Rule {
        id: ID!
        spaces: [String!]!
        name: String!
        watch_type: WatchType!
        criteria: String!
        # optional to include record in alert message
        include_record: Boolean
        record_fields: [String!]
        alert_on: AlertOn
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

    input RuleProperties {
        id: ID
        name: String
        spaces: [String!]
        watch_type: WatchType
        alert_on: InputAlertOn
        include_record: Boolean
    }

    type Query {
            getRules(
                ruleProperties: RuleProperties
                actionProperties: ActionProperties
            ): [Rule!]
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

    input InputAlertOn {
        reset_count: Int
        time_count: Int
        time_units: TimeUnits
    }

    type MutateRuleResponse {
        success: Boolean!
        message: String
        id: ID
        rule: Rule
    }

    type Mutation {
        addRule(
            name: String!
            spaces: [String!]!
            watch_type: WatchType!
            criteria: String!
            actions: [AddAction!]!
            include_record: Boolean
            record_fields: [String!]
            alert_on: InputAlertOn
        ): MutateRuleResponse

        deleteRule(
            id: ID!
        ): MutateRuleResponse

        editRule(
            id: ID!
            name: String
            watch_type: WatchType
            criteria: String
            alert_on: AlertOn
            include_record: Boolean
            record_fields: [String!]
            alert_on: InputAlertOn
            actions: [AddAction!]
        ): MutateRuleResponse
    }
`;
