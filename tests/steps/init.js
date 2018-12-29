module.exports.init = () => {
  process.env.mastersTable = `masters-${process.env.TEST_STAGE}`;
  process.env.AWS_REGION = "eu-west-1";
};
