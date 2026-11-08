const pool = require("../src/config/db");
const { runSeed } = require("../src/utils/seed");

(async () => {
  try {
    console.log("Seed selesai:", await runSeed());
  } catch (err) {
    console.error("Seed gagal:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
