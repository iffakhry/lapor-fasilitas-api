const router = require("express").Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { authenticate } = require("../middleware/auth");
const { HttpError, ok } = require("../utils/response");

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new HttpError(400, "Format gambar harus JPG, PNG, atau WebP"));
    }
    cb(null, true);
  },
});

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "laporan-fasilitas", resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });

// authenticate dipasang lebih dulu agar request tanpa token ditolak sebelum file diproses
router.post(
  "/images",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Field "image" wajib diisi');
    const result = await uploadToCloudinary(req.file.buffer);
    ok(res, { url: result.secure_url }, "Upload berhasil", 201);
  },
);

module.exports = router;
