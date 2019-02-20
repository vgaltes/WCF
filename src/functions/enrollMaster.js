const AWS = require("aws-sdk");
const chance = require("chance").Chance();
const sns = new AWS.SNS();

module.exports.handler = async event => {
  console.log(event.body);
  const { masterId } = JSON.parse(event.body);

  const orderId = chance.guid();
  console.log(`enrolling to master ${masterId} with order ID ${orderId}`);

  const data = {
    orderId,
    masterId
  };

  const params = {
    Message: JSON.stringify(data),
    TopicArn: process.env.enrollMasterSnsTopic
  };

  await sns.publish(params).promise();

  console.log(`published 'master_enrolled' event into Kinesis`);

  const response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  return response;
};
