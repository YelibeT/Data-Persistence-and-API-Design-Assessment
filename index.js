require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const { uuidv7 } = require('uuidv7');

const app = express();
app.use(cors());
app.use(express.json());


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});
console.log("DB URL Check:", process.env.DATABASE_URL ? "Found" : "Not Found");

const getAgeGroup = (age) => {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
};

app.post('/api/profiles', async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }

  try {
    const existing = await pool.query('SELECT * FROM profiles WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: existing.rows[0]
      });
    }

    const [gRes, aRes, nRes] = await Promise.all([
      axios.get(`https://api.genderize.io?name=${name}`),
      axios.get(`https://api.agify.io?name=${name}`),
      axios.get(`https://api.nationalize.io?name=${name}`)
    ]);

    if (!gRes.data.gender || gRes.data.count === 0) 
      return res.status(502).json({ status: "error", message: "Genderize returned an invalid response" });
    if (aRes.data.age === null) 
      return res.status(502).json({ status: "error", message: "Agify returned an invalid response" });
    if (!nRes.data.country || nRes.data.country.length === 0) 
      return res.status(502).json({ status: "error", message: "Nationalize returned an invalid response" });

    const topCountry = nRes.data.country.sort((a, b) => b.probability - a.probability)[0];
    const ageGroup = getAgeGroup(aRes.data.age);
    const newId = uuidv7();

    const result = await pool.query(
      `INSERT INTO profiles (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [newId, name.toLowerCase(), gRes.data.gender, gRes.data.probability, gRes.data.count, aRes.data.age, ageGroup, topCountry.country_id, topCountry.probability]
    );

    res.status(201).json({ status: "success", data: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const { gender, country_id, age_group } = req.query;
    let sql = 'SELECT * FROM profiles WHERE 1=1';
    let params = [];

    if (gender) {
      params.push(gender);
      sql += ` AND gender ILIKE $${params.length}`;
    }
    if (country_id) {
      params.push(country_id);
      sql += ` AND country_id ILIKE $${params.length}`;
    }
    if (age_group) {
      params.push(age_group);
      sql += ` AND age_group ILIKE $${params.length}`;
    }

    const result = await pool.query(sql, params);
    res.json({ status: "success", count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/profiles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));