import fs from "fs";
import { pool } from "../db/pool.js";

const data = JSON.parse(fs.readFileSync("./profiles.json", "utf-8"));

async function seed() {
  for (const p of data) {
    await pool.query(
      `
      INSERT INTO profiles (
        name, gender, gender_probability,
        age, age_group,
        country_id, country_name, country_probability
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (name) DO NOTHING
      `,
      [
        p.name,
        p.gender,
        p.gender_probability,
        p.age,
        p.age_group,
        p.country_id,
        p.country_name,
        p.country_probability,
      ]
    );
  }

  console.log("Seeding done");
  process.exit();
}

seed();
