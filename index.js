import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";
import { uuidv7 } from "uuidv7";

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const getAgeGroup = (age) => {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
};

app.post("/api/profiles", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }

  try {
    const existing = await pool.query("SELECT * FROM profiles WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows.length > 0) {
      return res.json({ status: "success", message: "Profile already exists", data: existing.rows[0] });
    }

    const [gRes, aRes, nRes] = await Promise.all([
      axios.get(`https://api.genderize.io?name=${name}`),
      axios.get(`https://api.agify.io?name=${name}`),
      axios.get(`https://api.nationalize.io?name=${name}`),
    ]);

    if (!gRes.data.gender || aRes.data.age === null || !nRes.data.country?.length) {
      return res.status(502).json({ status: "error", message: "External API failure" });
    }

    const topCountry = nRes.data.country.sort((a, b) => b.probability - a.probability)[0];
    const result = await pool.query(
      `INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_probability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [uuidv7(), name.toLowerCase(), gRes.data.gender, gRes.data.probability, aRes.data.age, getAgeGroup(aRes.data.age), topCountry.country_id, topCountry.probability]
    );

    res.status(201).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/profiles/search", async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase();
    if (!q || q.trim() === "") {
      return res.status(400).json({ status: "error", message: "Missing query" });
    }

    let sql = "SELECT * FROM profiles WHERE 1=1";
    let params = [];

    // Improved NLP Logic
    if (q.includes("female")) {
      params.push("female");
      sql += ` AND gender = $${params.length}`;
    } else if (q.includes("male")) {
      params.push("male");
      sql += ` AND gender = $${params.length}`;
    }

    const countryMap = { nigeria: "NG", kenya: "KE", ethiopia: "ET", ghana: "GH" };
    for (const [name, id] of Object.entries(countryMap)) {
      if (q.includes(name)) {
        params.push(id);
        sql += ` AND country_id = $${params.length}`;
      }
    }

    if (q.includes("young")) sql += " AND age BETWEEN 16 AND 24";
    if (q.includes("adult")) sql += " AND age_group = 'adult'";
    if (q.includes("teenager")) sql += " AND age_group = 'teenager'";
    
    const aboveMatch = q.match(/above\s+(\d+)/);
    if (aboveMatch) {
      params.push(parseInt(aboveMatch[1]));
      sql += ` AND age > $${params.length}`;
    }

    const result = await pool.query(sql, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "No matching profiles found" });
    }

    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/profiles", async (req, res) => {
  try {
    let { gender, country_id, age_group, min_age, max_age, sort_by = "created_at", order = "asc", page = 1, limit = 10 } = req.query;

    // Strict Query Validation
    const validSort = ["age", "gender_probability", "created_at", "id"];
    const validOrder = ["asc", "desc"];
    if (!validSort.includes(sort_by) || !validOrder.includes(order.toLowerCase())) {
      return res.status(400).json({ status: "error", message: "Invalid sort_by or order" });
    }

    page = parseInt(page);
    limit = parseInt(limit);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50; // Max-cap behavior

    let baseSql = "FROM profiles WHERE 1=1";
    let params = [];

    if (gender) { params.push(gender); baseSql += ` AND gender = $${params.length}`; }
    if (country_id) { params.push(country_id); baseSql += ` AND country_id = $${params.length}`; }
    if (age_group) { params.push(age_group); baseSql += ` AND age_group = $${params.length}`; }
    if (min_age) { params.push(Number(min_age)); baseSql += ` AND age >= $${params.length}`; }
    if (max_age) { params.push(Number(max_age)); baseSql += ` AND age <= $${params.length}`; }

    const totalRes = await pool.query("SELECT COUNT(*) " + baseSql, params);
    const total = parseInt(totalRes.rows[0].count);
    const offset = (page - 1) * limit;

    const finalQuery = `SELECT * ${baseSql} ORDER BY ${sort_by} ${order.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`;
    const result = await pool.query(finalQuery, params);

    // Standard Pagination Envelope
    res.json({
      status: "success",
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

app.delete("/api/profiles/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM profiles WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "::", () => console.log(`Server running on port ${PORT}`));