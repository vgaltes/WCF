/* eslint-disable global-require */
const http = require("superagent-promise")(require("superagent"), Promise);

const mode = process.env.TEST_MODE;

async function viaHttp(functionPath, method) {
  const apiRoot = process.env.TEST_BASE_URL;

  const url = `${apiRoot}/${functionPath}`;

  try {
    const res = await http(method, url);

    return {
      statusCode: res.status,
      body: res.body
    };
  } catch (err) {
    if (err.status) {
      return {
        statusCode: err.status
      };
    }
    throw err;
  }
}

async function viaHandler(functionPath) {
  // eslint-disable-next-line import/no-dynamic-require
  const handler = require(`../../src/functions/${functionPath}`);

  // due to https://github.com/middyjs/middy/issues/198
  return new Promise(async (resolve, reject) => {
    const event = {};
    const context = {};
    const callback = (something, response) => {
      response.body = JSON.parse(response.body);
      resolve(response);
    };
    await handler.handler(event, context, callback);
  });
}

module.exports.we_invoke_get_masters = () =>
  mode === "http" ? viaHttp("masters", "GET") : viaHandler("getMasters");
