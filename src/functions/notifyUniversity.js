/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const AWS = require("aws-sdk");
const _ = require("lodash");

const ses = new AWS.SES();
const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;
const { emailAddress } = process.env;

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

module.exports.handler = async event => {
  const records = getRecords(event);
  console.log(JSON.stringify(records));
  const orderPlaced = records.filter(r => r.eventType === "master_enrolled");

  for (const order of orderPlaced) {
    const emailParams = generateEmail(order.orderId, order.masterId);
    await ses.sendEmail(emailParams).promise();

    console.log(
      `notified universtity of order [${order.orderId}] for master [${
      order.masterId
      }]`
    );

    const data = _.clone(order);
    data.eventType = "university_notified";

    const kinesisReq = {
      Data: JSON.stringify(data), // the SDK would base64 encode this for us
      PartitionKey: order.orderId,
      StreamName: eventStream
    };

    await kinesis.putRecord(kinesisReq).promise();
    console.log(`published 'university_notified' event to Kinesis`);
  }

  return "all done";
};
