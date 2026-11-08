const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const { HttpError } = require("../utils/response");

function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token)
    throw new HttpError(401, "Token tidak ditemukan");
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Token sudah kedaluwarsa"
        : "Token tidak valid";
    throw new HttpError(401, message);
  }
}

function isValidAdminKey(value) {
  if (!value) return false;
  const a = Buffer.from(String(value));
  const b = Buffer.from(env.adminKey);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdminKey(req, res, next) {
  if (!isValidAdminKey(req.headers["x-admin-key"])) {
    throw new HttpError(403, "Kunci admin tidak valid");
  }
  next();
}

function authenticateOrAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key) {
    if (!isValidAdminKey(key))
      throw new HttpError(403, "Kunci admin tidak valid");
    req.isAdmin = true;
    return next();
  }
  return authenticate(req, res, next);
}

module.exports = { authenticate, requireAdminKey, authenticateOrAdmin };
