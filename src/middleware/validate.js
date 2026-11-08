const { HttpError } = require("../utils/response");

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validasi gagal", errors);
    }
    req.valid = req.valid || {};
    req.valid[source] = result.data;
    next();
  };

module.exports = validate;
