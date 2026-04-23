import express from "express";
import { pool } from "../db/pool.js";
import { parseQuery } from "../services/parser.js";

const router = express.Router();

async function getProfilesInternal(filters, pagination) {
  let { gender, age_group, country_id, min_age, max_age, sort_by = "created_at", order = "desc" } = filters;
  let { page = 1, limit = 10 } = pagination;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (parsedPage - 1) * parsedLimit;

  let baseQuery = "FROM profiles WHERE 1=1";
  let values = [];
  let i = 1;

  const add = (condition, value) => {
    baseQuery += ` AND ${condition.replace("?", `$${i}`)}`;
    values.push(value);
    i++;
  };

  if (gender) add("gender = ?", gender);
  if (age_group) add("age_group = ?", age_group);
  if (country_id) add("country_id = ?", country_id);
  if (min_age) add("age >= ?", Number(min_age));
  if (max_age) add("age <= ?", Number(max_age));

  const countResult = await pool.query("SELECT COUNT(*) " + baseQuery, values);
  const total = parseInt(countResult.rows[0].count);

  const direction = (order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const finalQuery = `SELECT * ${baseQuery} ORDER BY ${sort_by} ${direction} LIMIT $${i} OFFSET $${i + 1}`;
  
  values.push(parsedLimit, offset);
  const result = await pool.query(finalQuery, values);

  return { 
    total, 
    page: parsedPage, 
    limit: parsedLimit, 
    pages: Math.ceil(total / parsedLimit), 
    data: result.rows 
  };
}

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim() === "") {
      return res.status(400).json({ status: "error", message: "Missing query" });
    }

    /*const filters = parseQuery(q);
    if (Object.keys(filters).length === 0) {
      return res.status(422).json({ status: "error", message: "Unable to interpret query" });
    }*/

    const result = await getProfilesInternal(filters, req.query);
    res.json({ status: "success", data: result.data });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { sort_by, order } = req.query;
    const allowedSort = ["age", "created_at", "gender_probability", "id"];
    const allowedOrder = ["asc", "desc"];

    if (sort_by && !allowedSort.includes(sort_by)) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }
    if (order && !allowedOrder.includes(order.toLowerCase())) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    const result = await getProfilesInternal(req.query, req.query);
    res.json({ status: "success", ...result });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

export default router;