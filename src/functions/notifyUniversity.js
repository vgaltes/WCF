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
const { emailAddress } = process.env;
const { stage } = process.env;

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

  const orderPlaced = JSON.parse(event.Records[0].Sns.Message);
  log.info("Recieved order placed event", orderPlaced);

  const emailParams = generateEmail(orderPlaced.orderId, orderPlaced.masterId);
  await ses.sendEmail(emailParams).promise();

  log.info("notified universtity", {
    masterId: orderPlaced.masterId,
    orderId: orderPlaced.orderId
  });

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
