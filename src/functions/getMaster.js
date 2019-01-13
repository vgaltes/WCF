const AWS = require("aws-sdk");
const epsagon = require("epsagon");
const middy = require("middy");
const { ssm } = require("middy/middlewares");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.mastersTable;
const { stage } = process.env;

async function findMasterById(id) {
  const idAsInteger = parseInt(id, 10);
  const params = {
    TableName: tableName,
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": idAsInteger
    }
  };

  const masters = await dynamodb.query(params).promise();
  return masters.Items[0];
}

const handler = epsagon.lambdaWrapper(async (event, context) => {
  const { id } = event.pathParameters;

  epsagon.init({
    token: context.epsagonToken,
    appName: process.env.service,
    metadataOnly: false
  });

  const master = await findMasterById(id);

  const res = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(master)
  };

  return res;
});

module.exports.handler = middy(handler).use(
  ssm({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000,
    setToContext: true,
    names: {
      epsagonToken: `/pufouniversity/${stage}/epsagonToken`
    }
  })
);
