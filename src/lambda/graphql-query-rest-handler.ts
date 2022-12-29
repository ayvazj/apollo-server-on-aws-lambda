import { mutationAndQueryHandler, schema } from './graphql-query';
import { generateLambdaProxyResponse } from './utils';

const { parse, validate } = require('graphql');


export async function handleRESTMessage(event: any): Promise<any> {
  const operation = JSON.parse(event.body.replace(/\n/g, ''));
  const graphqlDocument = parse(operation.query);
  const validationErrors = validate(schema, graphqlDocument);

  if (validationErrors.length > 0) {
    return generateLambdaProxyResponse(400, JSON.stringify(validationErrors));
  }

  if (graphqlDocument.definitions[0].operation === 'subscription') {
    return generateLambdaProxyResponse(400, 'Subscription not support via REST');
  }

  return mutationAndQueryHandler(event);
}
