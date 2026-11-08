const router = require("express").Router();
const { z } = require("zod");
const pool = require("../config/db");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { HttpError, ok } = require("../utils/response");

const COLUMNS = "id, name, email, avatar_url, created_at, updated_at";

const updateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nama tidak boleh kosong")
      .max(100)
      .optional(),
    avatar_url: z.string().url("avatar_url harus berupa URL").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Minimal satu field harus diisi",
  });

router.get("/me", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM users WHERE id = $1`,
    [req.user.id],
  );
  if (!rows[0]) throw new HttpError(404, "Pengguna tidak ditemukan");
  ok(res, rows[0]);
});

router.patch("/me", authenticate, validate(updateSchema), async (req, res) => {
  const { name, avatar_url } = req.valid.body;
  const { rows } = await pool.query(
    `UPDATE users
     SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = now()
     WHERE id = $3
     RETURNING ${COLUMNS}`,
    [name ?? null, avatar_url ?? null, req.user.id],
  );
  ok(res, rows[0], "Profil diperbarui");
});

module.exports = router;
