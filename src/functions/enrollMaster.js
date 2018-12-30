const AWS = require("aws-sdk");
const chance = require("chance").Chance();

const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;

module.exports.handler = async event => {
  console.log(event.body);
  const { masterId } = JSON.parse(event.body);

  const orderId = chance.guid();
  console.log(`enrolling to master ${masterId} with order ID ${orderId}`);

  const data = {
    orderId,
    masterId,
    eventType: "master_enrolled"
  };

  const req = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: eventStream
  };

  await kinesis.putRecord(req).promise();

  console.log(`published 'master_enrolled' event into Kinesis`);

  const response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  return response;
};
