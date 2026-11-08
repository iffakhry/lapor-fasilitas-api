const router = require("express").Router();
const { z } = require("zod");
const pool = require("../config/db");
const validate = require("../middleware/validate");
const { authenticate, authenticateOrAdmin } = require("../middleware/auth");
const { HttpError, ok } = require("../utils/response");

const CONDITIONS = ["baik", "rusak_ringan", "rusak_sedang", "rusak_parah"];
const STATUSES = ["baru", "diproses", "selesai"];

const reportSchema = z.object({
  facility_name: z
    .string()
    .trim()
    .min(1, "Nama fasilitas wajib diisi")
    .max(150),
  location: z.string().trim().min(1, "Lokasi wajib diisi").max(150),
  condition: z.enum(CONDITIONS, {
    message: `condition harus salah satu dari: ${CONDITIONS.join(", ")}`,
  }),
  description: z.string().trim().max(1000).optional(),
  image_url: z.string().url("image_url harus berupa URL").optional(),
});

const statusSchema = z.object({
  status: z.enum(STATUSES, {
    message: `status harus salah satu dari: ${STATUSES.join(", ")}`,
  }),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  condition: z.enum(CONDITIONS).optional(),
  status: z.enum(STATUSES).optional(),
});

const SELECT_REPORT = `
  SELECT r.id, r.facility_name, r.location, r.condition, r.status, r.description, r.image_url,
         r.created_at, r.updated_at, r.user_id AS reporter_id, u.name AS reporter_name
  FROM reports r
  JOIN users u ON u.id = r.user_id`;

const toReport = (row) => ({
  id: row.id,
  facility_name: row.facility_name,
  location: row.location,
  condition: row.condition,
  status: row.status,
  description: row.description,
  image_url: row.image_url,
  reporter: { id: row.reporter_id, name: row.reporter_name },
  created_at: row.created_at,
  updated_at: row.updated_at,
});

async function findReport(id) {
  if (!z.string().uuid().safeParse(id).success)
    throw new HttpError(404, "Laporan tidak ditemukan");
  const { rows } = await pool.query(`${SELECT_REPORT} WHERE r.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Laporan tidak ditemukan");
  return rows[0];
}

async function listReports(res, query, userId) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };

  if (userId) add("r.user_id = ?", userId);
  if (query.condition) add("r.condition = ?", query.condition);
  if (query.status) add("r.status = ?", query.status);
  if (query.search)
    add("(r.facility_name ILIKE ? OR r.location ILIKE ?)", `%${query.search}%`);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.limit;

  const [data, count] = await Promise.all([
    pool.query(
      `${SELECT_REPORT} ${clause} ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM reports r ${clause}`,
      params,
    ),
  ]);

  const total = count.rows[0].total;
  ok(res, data.rows.map(toReport), "OK", 200, {
    page: query.page,
    limit: query.limit,
    total,
    total_pages: Math.ceil(total / query.limit),
  });
}

// --- Publik (tanpa login) ---
router.get("/", validate(listSchema, "query"), (req, res) =>
  listReports(res, req.valid.query),
);

router.get("/summary", async (req, res) => {
  const [byCondition, byStatus] = await Promise.all([
    pool.query(
      "SELECT condition AS key, COUNT(*)::int AS total FROM reports GROUP BY condition",
    ),
    pool.query(
      "SELECT status AS key, COUNT(*)::int AS total FROM reports GROUP BY status",
    ),
  ]);
  const fill = (keys, rows) =>
    Object.fromEntries(
      keys.map((k) => [k, rows.find((r) => r.key === k)?.total ?? 0]),
    );
  const by_condition = fill(CONDITIONS, byCondition.rows);
  const by_status = fill(STATUSES, byStatus.rows);
  const total = Object.values(by_status).reduce((a, b) => a + b, 0);
  ok(res, { total, by_condition, by_status });
});

// --- Wajib login ---
router.get("/mine", authenticate, validate(listSchema, "query"), (req, res) =>
  listReports(res, req.valid.query, req.user.id),
);

// --- Detail publik (didaftarkan setelah /summary dan /mine) ---
router.get("/:id", async (req, res) => {
  ok(res, toReport(await findReport(req.params.id)));
});

router.post("/", authenticate, validate(reportSchema), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await pool.query(
    `INSERT INTO reports (user_id, facility_name, location, condition, description, image_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      req.user.id,
      b.facility_name,
      b.location,
      b.condition,
      b.description ?? null,
      b.image_url ?? null,
    ],
  );
  ok(
    res,
    toReport(await findReport(rows[0].id)),
    "Laporan berhasil dibuat",
    201,
  );
});

router.put("/:id", authenticate, validate(reportSchema), async (req, res) => {
  const report = await findReport(req.params.id);
  if (report.reporter_id !== req.user.id)
    throw new HttpError(403, "Anda bukan pemilik laporan ini");

  const b = req.valid.body;
  await pool.query(
    `UPDATE reports
     SET facility_name = $1, location = $2, condition = $3, description = $4, image_url = $5, updated_at = now()
     WHERE id = $6`,
    [
      b.facility_name,
      b.location,
      b.condition,
      b.description ?? null,
      b.image_url ?? null,
      req.params.id,
    ],
  );
  ok(res, toReport(await findReport(req.params.id)), "Laporan berhasil diubah");
});

router.patch(
  "/:id/status",
  authenticateOrAdmin,
  validate(statusSchema),
  async (req, res) => {
    const report = await findReport(req.params.id);
    if (!req.isAdmin && report.reporter_id !== req.user.id) {
      throw new HttpError(
        403,
        "Hanya pemilik laporan atau dosen yang dapat mengubah status",
      );
    }
    await pool.query(
      "UPDATE reports SET status = $1, updated_at = now() WHERE id = $2",
      [req.valid.body.status, req.params.id],
    );
    ok(
      res,
      toReport(await findReport(req.params.id)),
      "Status laporan diperbarui",
    );
  },
);

router.delete("/:id", authenticate, async (req, res) => {
  const report = await findReport(req.params.id);
  if (report.reporter_id !== req.user.id)
    throw new HttpError(403, "Anda bukan pemilik laporan ini");
  await pool.query("DELETE FROM reports WHERE id = $1", [req.params.id]);
  ok(res, null, "Laporan berhasil dihapus");
});

module.exports = router;
