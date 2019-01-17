/* eslint-disable import/no-unresolved */
const AWS = require("aws-sdk");
const chance = require("chance").Chance();
const epsagon = require("epsagon");
const middy = require("middy");
const { ssm } = require("middy/middlewares");
const log = require("../lib/log");

const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;
const { stage } = process.env;

const handler = epsagon.lambdaWrapper(async (event, context) => {
  epsagon.init({
    token: context.epsagonToken,
    appName: process.env.service,
    metadataOnly: false
  });

  console.log(event.body);
  const { masterId } = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  const userEmail = event.requestContext.authorizer.claims.email;

  const orderId = chance.guid();
  log.info("enrolling to master", { masterId, orderId, userEmail });

  const data = {
    orderId,
    masterId,
    userEmail,
    eventType: "master_enrolled"
  };

  const req = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: eventStream
  };

  await kinesis.putRecord(req).promise();

  log.info("published 'master_enrolled' event", { masterId, orderId });

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({ orderId })
  };

  return response;
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
