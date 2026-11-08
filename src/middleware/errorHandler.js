const multer = require("multer");
const { HttpError } = require("../utils/response");

function notFound(req, res) {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
}

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      success: false,
      message: tooBig ? "Ukuran file maksimal 2 MB" : err.message,
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "Body JSON tidak valid" });
  }
  if (err.code === "23505") {
    return res.status(409).json({ success: false, message: "Data sudah ada" });
  }
  console.error(err);
  res
    .status(500)
    .json({ success: false, message: "Terjadi kesalahan pada server" });
}

module.exports = { notFound, errorHandler };
