const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const env = require("../config/env");

const SEED_PASSWORD = "password123";

const USERS = [
  { name: "Mahasiswa Satu", email: "mahasiswa1@example.com" },
  { name: "Mahasiswa Dua", email: "mahasiswa2@example.com" },
  { name: "Mahasiswa Tiga", email: "mahasiswa3@example.com" },
];

const REPORTS = [
  {
    owner: 0,
    facility_name: "Proyektor Ruang Kelas",
    location: "Gedung A, Ruang 2.3",
    condition: "rusak_sedang",
    status: "diproses",
    description: "Gambar berkedip dan warna menguning.",
  },
  {
    owner: 0,
    facility_name: "Toilet Lantai 2",
    location: "Gedung B",
    condition: "rusak_parah",
    status: "baru",
    description: "Kran patah dan lantai bocor.",
  },
  {
    owner: 1,
    facility_name: "AC Laboratorium",
    location: "Lab Komputer 1",
    condition: "rusak_ringan",
    status: "baru",
    description: "AC kurang dingin saat siang.",
  },
  {
    owner: 1,
    facility_name: "Lampu Koridor",
    location: "Gedung C Lantai 1",
    condition: "baik",
    status: "selesai",
    description: "Lampu sudah diganti dan menyala normal.",
  },
  {
    owner: 2,
    facility_name: "Kursi Perpustakaan",
    location: "Perpustakaan Lantai 2",
    condition: "rusak_ringan",
    status: "diproses",
    description: "Dua kursi goyang dan perlu dikencangkan.",
  },
  {
    owner: 2,
    facility_name: "Atap Kantin",
    location: "Kantin Utama",
    condition: "rusak_parah",
    status: "baru",
    description: "Atap bocor saat hujan dan membahayakan.",
  },
];

async function runSeed() {
  const hash = await bcrypt.hash(SEED_PASSWORD, env.bcryptRounds);
  const ids = [];

  for (const u of USERS) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [u.name, u.email, hash],
    );
    ids.push(rows[0].id);
  }

  await pool.query("DELETE FROM reports WHERE user_id = ANY($1::uuid[])", [
    ids,
  ]);

  for (const r of REPORTS) {
    await pool.query(
      `INSERT INTO reports (user_id, facility_name, location, condition, status, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ids[r.owner],
        r.facility_name,
        r.location,
        r.condition,
        r.status,
        r.description,
      ],
    );
  }

  return { users: USERS.length, reports: REPORTS.length };
}

module.exports = { runSeed };
