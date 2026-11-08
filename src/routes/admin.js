const router = require("express").Router();
const pool = require("../config/db");
const { requireAdminKey } = require("../middleware/auth");
const { ok } = require("../utils/response");
const { runSeed } = require("../utils/seed");

router.post("/reset", requireAdminKey, async (req, res) => {
  await pool.query("TRUNCATE TABLE refresh_tokens, reports, users");
  const seeded = req.query.seed === "true" ? await runSeed() : null;
  ok(res, { seeded }, "Data berhasil direset");
});

module.exports = router;
