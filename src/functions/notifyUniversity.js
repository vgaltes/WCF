/* eslint-disable import/no-unresolved */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const AWS = require("aws-sdk");
const _ = require("lodash");
const epsagon = require("epsagon");
const middy = require("middy");
const { ssm } = require("middy/middlewares");
const log = require("../lib/log");

const ses = new AWS.SES();
const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;
const { emailAddress } = process.env;
const { stage } = process.env;

function parsePayload(record) {
  const json = Buffer.from(record.kinesis.data, "base64").toString("utf8");
  return JSON.parse(json);
}

function getRecords(event) {
  return event.Records.map(parsePayload);
}

function generateEmail(orderId, masterId) {
  return {
    Source: emailAddress,
    Destination: { ToAddresses: [emailAddress] },
    ReplyToAddresses: [emailAddress],
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `User has enrolled to master ${masterId} with order id ${orderId}`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: `[PufoUniversity] new enrollment`
      }
    }
  };
}

const handler = epsagon.lambdaWrapper(async (event, context) => {
  epsagon.init({
    token: context.epsagonToken,
    appName: process.env.service,
    metadataOnly: false
  });

  const records = getRecords(event);
  const orderPlaced = records.filter(r => r.eventType === "master_enrolled");

  log.info(`received ${orderPlaced.length} master_enrolled events`);

  for (const order of orderPlaced) {
    const emailParams = generateEmail(order.orderId, order.masterId);
    await ses.sendEmail(emailParams).promise();

    log.info("notified universtity", {
      masterId: order.masterId,
      orderId: order.orderId
    });

    const data = _.clone(order);
    data.eventType = "university_notified";

    const kinesisReq = {
      Data: JSON.stringify(data), // the SDK would base64 encode this for us
      PartitionKey: order.orderId,
      StreamName: eventStream
    };

    await kinesis.putRecord(kinesisReq).promise();
    log.info("published 'university_notified' event", {
      masterId: order.masterId,
      orderId: order.orderId
    });
  }

  return "all done";
});

module.exports.handler = middy(handler).use(
  ssm({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000,
    setToContext: true,
    names: {
      epsagonToken: `/pufouniversity/${stage}/epsagonTokenSecure`
    }
  })
);
