const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const pool = require("../config/db");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function issueTokens(user) {
  const token = jwt.sign({ email: user.email }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });
  const refreshToken = jwt.sign({}, env.jwtRefreshSecret, {
    subject: user.id,
    expiresIn: env.jwtRefreshExpiresIn,
    jwtid: crypto.randomUUID(),
  });

  const access = jwt.decode(token);
  const refresh = jwt.decode(refreshToken);
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3))",
    [user.id, sha256(refreshToken), refresh.exp],
  );

  return {
    token,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: access.exp - access.iat,
  };
}

module.exports = { issueTokens, sha256 };
