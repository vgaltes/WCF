const AWS = require("aws-sdk");
const chance = require("chance").Chance();
require("dotenv").config();

const randomPassword = () =>
  // needs number, special char, upper and lower case
  `${chance.string({ length: 8 })}Un1vers1t1!`;

module.exports.an_authenticated_user = async () => {
  AWS.config.region = process.env.AWS_REGION;
  const cognito = new AWS.CognitoIdentityServiceProvider();

  const userpoolId = process.env.cognitoUserPoolId;
  const clientId = process.env.cognitoServerClientId;

  const firstName = chance.first();
  const lastName = chance.last();
  const username = `test-${firstName}-${lastName}-${chance.string({
    length: 8
  })}`;
  const password = randomPassword();
  const email = `${firstName}-${lastName}@pufouniversity.com`;

  const createReq = {
    UserPoolId: userpoolId,
    Username: email,
    MessageAction: "SUPPRESS",
    TemporaryPassword: password,
    UserAttributes: [
      { Name: "given_name", Value: firstName },
      { Name: "family_name", Value: lastName },
      { Name: "email", Value: email }
    ]
  };

  await cognito.adminCreateUser(createReq).promise();

  console.log(`[${username}] - user is created`);

  const req = {
    AuthFlow: "ADMIN_NO_SRP_AUTH",
    UserPoolId: userpoolId,
    ClientId: clientId,
    AuthParameters: { USERNAME: email, PASSWORD: password }
  };

  const resp = await cognito.adminInitiateAuth(req).promise();

  console.log(`[${email}] - initialised auth flow`);

  const challengeReq = {
    UserPoolId: userpoolId,
    ClientId: clientId,
    ChallengeName: resp.ChallengeName,
    Session: resp.Session,
    ChallengeResponses: { USERNAME: email, NEW_PASSWORD: randomPassword() }
  };

  const challengeResp = await cognito
    .adminRespondToAuthChallenge(challengeReq)
    .promise();

  console.log(`[${username}] - responded to auth challenge`);
  return {
    email,
    firstName,
    lastName,
    idToken: challengeResp.AuthenticationResult.IdToken
  };
};
