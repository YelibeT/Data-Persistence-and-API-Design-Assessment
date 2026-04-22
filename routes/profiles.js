import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/**
 * GET /api/profiles
 */
router.get("/", async (req, res) => {
  try {
    let {
      gender,
      age_group,
      country_id,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by,
      order,
      page = 1,
      limit = 10,
    } = req.query;

    limit = Math.min(parseInt(limit), 50);
    page = parseInt(page);
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM profiles WHERE 1=1";
    let countQuery = "SELECT COUNT(*) FROM profiles WHERE 1=1";
    let values = [];
    let i = 1;

    function addCondition(sql, condition, value) {
      query += ` AND ${condition.replace("?", `$${i}`)}`;
      countQuery += ` AND ${condition.replace("?", `$${i}`)}`;
      values.push(value);
      i++;
    }

    if (gender) addCondition(query, "gender = ?", gender);
    if (age_group) addCondition(query, "age_group = ?", age_group);
    if (country_id) addCondition(query, "country_id = ?", country_id);

    if (min_age) addCondition(query, "age >= ?", min_age);
    if (max_age) addCondition(query, "age <= ?", max_age);

    if (min_gender_probability)
      addCondition(query, "gender_probability >= ?", min_gender_probability);

    if (min_country_probability)
      addCondition(query, "country_probability >= ?", min_country_probability);

    // sorting whitelist
    const allowedSort = ["age", "created_at", "gender_probability"];
    sort_by = allowedSort.includes(sort_by) ? sort_by : "created_at";
    order = order === "asc" ? "ASC" : "DESC";

    query += ` ORDER BY ${sort_by} ${order}`;

    query += ` LIMIT $${i} OFFSET $${i + 1}`;
    values.push(limit, offset);

    const dataResult = await pool.query(query, values);
    const countResult = await pool.query(countQuery, values.slice(0, i - 1));

    res.json({
      status: "success",
      page,
      limit,
      total: parseInt(countResult.rows[0].count),
      data: dataResult.rows,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Server failure",
    });
  }
});


router.get("/search", async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase();

    if (!q) {
      return res.status(400).json({
        status: "error",
        message: "Missing query",
      });
    }

    const filters = parseQuery(q);

    if (Object.keys(filters).length === 0) {
      return res.status(422).json({
        status: "error",
        message: "Unable to interpret query",
      });
    }

    req.query = { ...req.query, ...filters };

    // reuse same logic by calling internal handler
    req.url = "/";
    router.handle(req, res);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Server failure",
    });
  }
});

export default router;
