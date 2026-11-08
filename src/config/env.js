require("dotenv").config();

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "ADMIN_KEY",
];
for (const key of required) {
  if (!process.env[key])
    throw new Error(`Environment variable ${key} belum diisi`);
}

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  adminKey: process.env.ADMIN_KEY,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 8,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};
