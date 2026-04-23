import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

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
  if (query.includes("teenager")) filters.age_group = "teenager";
  if (query.includes("adult")) filters.age_group = "adult";
  if (query.includes("senior")) filters.age_group = "senior";

  if (query.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  const aboveMatch = query.match(/above\s+(\d+)/);
  if (aboveMatch) filters.min_age = Number(aboveMatch[1]) + 1;

  const belowMatch = query.match(/below\s+(\d+)/);
  if (belowMatch) filters.max_age = Number(belowMatch[1]) - 1;

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

    const allowedSort = ["age", "created_at", "gender_probability", "id"];
    const allowedOrder = ["asc", "desc"];

    if (sort_by && !allowedSort.includes(sort_by)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid query parameters",
      });
    }

    if (order && !allowedOrder.includes(order.toLowerCase())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid query parameters",
      });
    }

    sort_by = sort_by || "created_at";
    order = (order || "desc").toLowerCase();

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
    if (min_gender_probability) add("gender_probability >= ?", Number(min_gender_probability));
    if (min_country_probability) add("country_probability >= ?", Number(min_country_probability));

    const countResult = await pool.query("SELECT COUNT(*) " + baseQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const direction = order === "asc" ? "ASC" : "DESC";
    let finalQuery = `SELECT * ${baseQuery} ORDER BY ${sort_by} ${direction} LIMIT $${i} OFFSET $${i + 1}`;
    
    values.push(parsedLimit, offset);

    const result = await pool.query(finalQuery, values);

    res.json({
      status: "success",
      total: total,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.ceil(total / parsedLimit),
      data: result.rows,
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
    const q = req.query.q;

    if (!q || q.trim() === "") {
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

    const { total, page, limit, data } = await getProfilesInternal(filters, req.query);
    
    if (data.length === 0) {
        return res.status(404).json({
            status: "error",
            message: "No matching profiles found"
        });
    }

    res.json({
      status: "success",
      data: data,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Server failure",
    });
  }
});

async function getProfilesInternal(filters, pagination) {
    let { gender, age_group, country_id, min_age, max_age } = filters;
    let { page = 1, limit = 10 } = pagination;

    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * parsedLimit;

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

    values.push(parsedLimit, offset);
    const result = await pool.query(`SELECT * ${baseQuery} LIMIT $${i} OFFSET $${i+1}`, values);

    return { total, page, limit: parsedLimit, data: result.rows };
}

export default router;