/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const AWS = require("aws-sdk");
const ses = new AWS.SES();
const { emailAddress } = process.env;

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
  const orderPlaced = JSON.parse(event.Records[0].Sns.Message);
  console.log(orderPlaced);

  const emailParams = generateEmail(orderPlaced.orderId, orderPlaced.masterId);
  await ses.sendEmail(emailParams).promise();

  console.log(
    `notified universtity of order [${orderPlaced.orderId}] for master [${
      orderPlaced.masterId
    }]`
  );

  return "all done";
};
