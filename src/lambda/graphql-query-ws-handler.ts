import { mutationAndQueryHandler, schema } from './graphql-query';
import { generateApolloCompatibleEventFromWebsocketEvent, generateLambdaProxyResponse } from './utils';

const { parse, validate } = require('graphql');

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const dynamoDbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

const gatewayClient = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

export async function handleWSMessage(event: any): Promise<any> {
  const operation = JSON.parse(event.body.replace(/\n/g, ''));
  const graphqlDocument = parse(operation.query);
  const validationErrors = validate(schema, graphqlDocument);

  if (validationErrors.length > 0) {
    await gatewayClient.postToConnection({
      ConnectionId: event.requestContext.connectionId,
      Data: JSON.stringify(validationErrors),
    }).promise();
    return generateLambdaProxyResponse(400, JSON.stringify(validationErrors));
  }

  if (graphqlDocument.definitions[0].operation === 'subscription') {
    const { connectionId } = event.requestContext;
    const chatId: string = graphqlDocument.definitions[0].selectionSet.selections[0].arguments[0].value.value;

    const oneHourFromNow = Math.round(Date.now() / 1000 + 3600);
    await dynamoDbClient.put({
      TableName: process.env.TABLE_NAME!,
      Item: {
        chatId,
        connectionId,
        ttl: oneHourFromNow,
      },
    }).promise();

    return generateLambdaProxyResponse(200, 'Ok');
  }

  const response = await mutationAndQueryHandler(generateApolloCompatibleEventFromWebsocketEvent(event));
  await gatewayClient.postToConnection({
    ConnectionId: event.requestContext.connectionId,
    Data: response.body,
  }).promise();

  return response;
}

