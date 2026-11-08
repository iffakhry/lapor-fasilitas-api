const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const pool = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1); // wajib di balik proxy Render
app.use(helmet({ contentSecurityPolicy: false })); // CSP dimatikan agar Swagger UI tampil
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  let db = "up";
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    db = "down";
  }
  res.json({
    success: true,
    message: "OK",
    data: { status: "up", db, time: new Date().toISOString() },
  });
});

// ROUTE LAINNYA DITAMBAHKAN DI SINI PADA TAHAP BERIKUTNYA
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/uploads", require("./routes/uploads"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
