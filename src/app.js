const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const YAML = require("yamljs");
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

const spec = YAML.load(path.join(__dirname, "docs/openapi.yaml"));
app.get("/", (req, res) => res.redirect("/docs"));
app.get("/openapi.json", (req, res) => res.json(spec));
app.get("/docs", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API Laporan Fasilitas</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`);
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
