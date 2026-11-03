// Seeds ONLY what the app cannot run without: roles, a default grade scale, and the first admin.
// No demo students/teachers/classes are created.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../../backend/config/db');
const { BCRYPT_ROUNDS } = require('../../backend/services/auth.service');

const ROLES = ['admin', 'teacher', 'student', 'parent'];
// Editable later from the admin UI (Phase 4); stored in the grade_scale table.
const GRADES = [
  ['A+', 90, 100], ['A', 80, 89.99], ['B+', 70, 79.99], ['B', 60, 69.99],
  ['C', 50, 59.99], ['D', 40, 49.99], ['F', 0, 39.99],
];

(async () => {
  for (const role of ROLES) await pool.query('INSERT IGNORE INTO roles (name) VALUES (?)', [role]);

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM grade_scale');
  if (n === 0) {
    for (const [grade, min, max] of GRADES) {
      await pool.query('INSERT INTO grade_scale (grade, min_percent, max_percent) VALUES (?, ?, ?)', [grade, min, max]);
    }
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'School Admin').trim();
  if (!email || password.length < 10) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 characters) in .env before seeding.');
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    console.log(`Admin ${email} already exists - left unchanged.`);
  } else {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query(
      'INSERT INTO users (role_id, name, email, password_hash) VALUES ((SELECT id FROM roles WHERE name = "admin"), ?, ?, ?)',
      [name, email, hash]
    );
    console.log(`Admin account created for ${email}.`);
  }
  console.log('Seed complete.');
})()
  .catch((err) => { console.error('Seed failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
