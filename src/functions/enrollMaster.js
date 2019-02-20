/* eslint-disable import/no-unresolved */
const AWS = require("aws-sdk");
const chance = require("chance").Chance();
const epsagon = require("epsagon");
const middy = require("middy");
const { ssm } = require("middy/middlewares");
const log = require("../lib/log");
const sns = new AWS.SNS();

const { stage } = process.env;

const handler = epsagon.lambdaWrapper(async (event, context) => {
  epsagon.init({
    token: context.epsagonToken,
    appName: process.env.service,
    metadataOnly: false
  });

  const { masterId } = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  const orderId = chance.guid();
  log.info("enrolling to master", { masterId, orderId });

  const data = {
    orderId,
    masterId
  };

  const params = {
    Message: JSON.stringify(data),
    TopicArn: process.env.enrollMasterSnsTopic
  };

  await sns.publish(params).promise();

  log.info("published 'master_enrolled' event", { masterId, orderId });

  const response = {
    statusCode: 200,
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
