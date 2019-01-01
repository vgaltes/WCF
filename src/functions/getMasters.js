/* eslint-disable import/no-unresolved */
const AWS = require("aws-sdk");
const epsagon = require("epsagon");
const middy = require("middy");
const { ssm } = require("middy/middlewares");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.mastersTable;
const { stage } = process.env;

const handler = epsagon.lambdaWrapper(async (event, context) => {
  const count = 8;

  epsagon.init({
    token: context.epsagonToken,
    appName: process.env.service,
    metadataOnly: false
  });

  const req = {
    TableName: tableName,
    Limit: count
  };

  const resp = await dynamodb.scan(req).promise();

  const res = {
    statusCode: 200,
    body: JSON.stringify(resp.Items)
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
