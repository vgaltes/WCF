const when = require("./steps/when");
const given = require("./steps/given");
const { init } = require("./steps/init");

describe(`Given an authenticated user`, () => {
  beforeEach(() => {
    init();
  });

  describe(`When we invoke the GET /master/{id} endpoint`, () => {
    test(`Should return the details of the master`, async () => {
      const user = await given.an_authenticated_user();
      const res = await when.we_invoke_get_master_details(user, 1);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("description");
    });
  });
});
