const { ApolloServer, gql } = require('apollo-server-lambda');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const REQUEST_EVENT_DETAIL_TYPE = process.env.REQUEST_EVENT_DETAIL_TYPE!;

const eventBridge = new AWS.EventBridge({
    region: process.env.AWS_REGION,
  });

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type EventDetails {
    EventId: String
    ErrorMessage: String
    ErrorCode: String
  }

  type Mutation {
    putEvent(message: String!, chatId: String!): Result
  }

  type Query {
    getEvent: String
  }

  type Result {
    Entries: [EventDetails]
    FailedEntries: Int
  }

  type Subscription {
    chat(chatId: String!): String
  }

  schema {
    query: Query
    mutation: Mutation
    subscription: Subscription
  }
`;

// Provide resolver functions for your schema fields

const resolvers = {
  Mutation: {
    // tslint:disable-next-line:no-any
    putEvent: async (_: any, { message, chatId }: any) => eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.BUS_NAME,
          Source: 'apollo',
          DetailType: REQUEST_EVENT_DETAIL_TYPE,
          Detail: JSON.stringify({
            message,
            chatId,
          }),
        },
      ],
    }).promise(),
  },
  Query: {
    getEvent: () => 'Hello from Apollo!',
  },
};
export const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
});

export const mutationAndQueryHandler = server.createHandler();