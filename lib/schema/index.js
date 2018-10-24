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

    type Rule {
        uuid: ID!
        name: String!
        watch_type: WatchType!
        criteria: String!
        actions: [Action!]!
    }

    type Action {
        action_type: ActionType!
        message: String
        url: String
        token: String
        to: [String!]
        bcc: [String!]
        from: String
        ffrom: String
        subject: String
    }

    type Query {
            getRules(
                watchType: WatchType,
                actionType: ActionType,
                id: ID
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

    type MutateRuleResponse {
        success: Boolean!
        message: String
        uuid: ID
        rule: Rule
    }

    type Mutation {
        addRule(
            name: String!
            spaces: String!
            watch_type: WatchType!
            criteria: String!
            actions: [AddAction!]!
        ): MutateRuleResponse

        deleteRule(
            id: ID!
        ): MutateRuleResponse

        editRule(
            id: ID!
            name: String
            watch_type: WatchType
            criteria: String
            actions: [AddAction!]
        ): MutateRuleResponse
    }
`;
