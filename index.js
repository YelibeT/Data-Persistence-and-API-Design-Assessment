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

function parseQuery(q) {
  const filters = {};
  const query = q.toLowerCase();

  const hasMale = /\bmales?\b/.test(query);
  const hasFemale = /\bfemales?\b/.test(query);

  if (hasMale && !hasFemale) {
    filters.gender = "male";
  } else if (hasFemale && !hasMale) {
    filters.gender = "female";
  }

  if (query.includes("child")) filters.age_group = "child";
  if (/\bteenagers?\b/.test(query)) filters.age_group = "teenager";
  if (query.includes("adult")) filters.age_group = "adult";
  if (query.includes("senior")) filters.age_group = "senior";

  if (query.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  const above = query.match(/above\s+(\d+)/);
  if (above) {
    const min = Number(above[1]) + 1;
    filters.min_age = filters.min_age ? Math.max(filters.min_age, min) : min;
  }

  const below = query.match(/below\s+(\d+)/);
  if (below) {
    const max = Number(below[1]) - 1;
    filters.max_age = filters.max_age ? Math.min(filters.max_age, max) : max;
  }

  const countryMap = { 
    nigeria: "NG", 
    kenya: "KE", 
    ethiopia: "ET", 
    ghana: "GH", 
    uganda: "UG" 
  };
  for (const [name, id] of Object.entries(countryMap)) {
    if (query.includes(name)) filters.country_id = id;
  }

  return filters;
}

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
    const q = req.query.q;
    if (!q || q.trim() === "") {
      return res.status(400).json({ status: "error", message: "Missing query" });
    }

    const filters = parseQuery(q);
    if (Object.keys(filters).length === 0) {
      return res.status(422).json({ status: "error", message: "Unable to interpret query" });
    }

    let sql = "SELECT * FROM profiles WHERE 1=1";
    let params = [];
    let i = 1;

    if (filters.gender) {
      sql += ` AND gender = $${i++}`;
      params.push(filters.gender);
    }
    if (filters.country_id) {
      sql += ` AND country_id = $${i++}`;
      params.push(filters.country_id);
    }
    if (filters.age_group) {
      sql += ` AND age_group = $${i++}`;
      params.push(filters.age_group);
    }
    if (filters.min_age) {
      sql += ` AND age >= $${i++}`;
      params.push(filters.min_age);
    }
    if (filters.max_age) {
      sql += ` AND age <= $${i++}`;
      params.push(filters.max_age);
    }

    const result = await pool.query(sql, params);

    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

app.get("/api/profiles", async (req, res) => {
  try {
    let { gender, country_id, age_group, min_age, max_age, sort_by = "created_at", order = "desc", page = 1, limit = 10 } = req.query;

    const validSort = ["age", "gender_probability", "created_at", "id"];
    const validOrder = ["asc", "desc"];
    if (!validSort.includes(sort_by) || !validOrder.includes(order.toLowerCase())) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    let baseSql = "FROM profiles WHERE 1=1";
    let params = [];
    let i = 1;

    if (gender) { baseSql += ` AND gender = $${i++}`; params.push(gender); }
    if (country_id) { baseSql += ` AND country_id = $${i++}`; params.push(country_id); }
    if (age_group) { baseSql += ` AND age_group = $${i++}`; params.push(age_group); }
    if (min_age) { baseSql += ` AND age >= $${i++}`; params.push(Number(min_age)); }
    if (max_age) { baseSql += ` AND age <= $${i++}`; params.push(Number(max_age)); }

    const countRes = await pool.query("SELECT COUNT(*) " + baseSql, params);
    const total = parseInt(countRes.rows[0].count);

    const finalQuery = `SELECT * ${baseSql} ORDER BY ${sort_by} ${order.toUpperCase()} LIMIT $${i++} OFFSET $${i++}`;
    params.push(parsedLimit, offset);

    const result = await pool.query(finalQuery, params);

    res.json({
      status: "success",
      total,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.ceil(total / parsedLimit),
      data: result.rows
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