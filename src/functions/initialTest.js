module.exports.handler = async event => {
  const { name } = event.pathParameters;

  const res = {
    statusCode: 200,
    body: JSON.stringify(`Hello ${name}`)
  };

  return res;
};
