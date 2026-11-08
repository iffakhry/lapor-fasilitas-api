const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../config/db");
const env = require("../config/env");
const validate = require("../middleware/validate");
const { HttpError, ok } = require("../utils/response");
const { issueTokens, sha256 } = require("../utils/tokens");

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format email tidak valid");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: emailField,
  password: z.string().min(6, "Password minimal 6 karakter"),
});
const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password wajib diisi"),
});
const refreshSchema = z.object({
  refresh_token: z.string().min(1, "refresh_token wajib diisi"),
});

router.post("/register", validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.valid.body;

  const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [
    email,
  ]);
  if (exists.rowCount > 0) throw new HttpError(409, "Email sudah terdaftar");

  const hash = await bcrypt.hash(password, env.bcryptRounds);
  const { rows } = await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, avatar_url",
    [name, email, hash],
  );
  ok(res, rows[0], "Registrasi berhasil", 201);
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;

  const { rows } = await pool.query(
    "SELECT id, name, email, avatar_url, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, "Email atau password salah");

  const tokens = await issueTokens(user);
  ok(
    res,
    {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    },
    "Login berhasil",
  );
});

router.post("/refresh", validate(refreshSchema), async (req, res) => {
  const { refresh_token } = req.valid.body;

  let payload;
  try {
    payload = jwt.verify(refresh_token, env.jwtRefreshSecret);
  } catch (err) {
    throw new HttpError(401, "Refresh token tidak valid atau kedaluwarsa");
  }

  // Rotasi: token hanya bisa dipakai sekali. UPDATE ini atomik, sehingga dua
  // request bersamaan dengan token yang sama tidak mungkin sama-sama berhasil.
  const used = await pool.query(
    `UPDATE refresh_tokens SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(refresh_token)],
  );
  if (used.rowCount === 0)
    throw new HttpError(401, "Refresh token tidak valid atau sudah dipakai");

  const { rows } = await pool.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [payload.sub],
  );
  if (!rows[0]) throw new HttpError(401, "Pengguna tidak ditemukan");

  ok(res, await issueTokens(rows[0]), "Token diperbarui");
});

module.exports = router;
