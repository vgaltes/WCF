const when = require("./steps/when");
const { init } = require("./steps/init");

describe(`When we invoke the GET /masters endpoint`, () => {
  beforeAll(() => {
    init();
  });

  test(`Should return an array of 8 masters`, async () => {
    const res = await when.we_invoke_get_masters();

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(8);

    for (let i = 0; i < res.body.length; i += 1) {
      const master = res.body[i];
      expect(master).toHaveProperty("id");
      expect(master).toHaveProperty("name");
      expect(master).toHaveProperty("description");
    }
  });
});
