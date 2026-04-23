export function parseQuery(q) {
  const filters = {};

  if (!q || typeof q !== "string") return filters;

  q = q.toLowerCase();

  const hasMale = /\bmales?\b/.test(q);
  const hasFemale = /\bfemales?\b/.test(q);

  if (hasMale && !hasFemale) {
    filters.gender = "male";
  } else if (hasFemale && !hasMale) {
    filters.gender = "female";
  }

  if (q.includes("child")) filters.age_group = "child";
  if (/\bteenagers?\b/.test(q)) filters.age_group = "teenager";
  if (q.includes("adult")) filters.age_group = "adult";
  if (q.includes("senior")) filters.age_group = "senior";

  if (q.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  const above = q.match(/above\s+(\d+)/);
  if (above) {
    const min = Number(above[1]) + 1;
    filters.min_age = filters.min_age ? Math.max(filters.min_age, min) : min;
  }

  const below = q.match(/below\s+(\d+)/);
  if (below) {
    const max = Number(below[1]) - 1;
    filters.max_age = filters.max_age ? Math.min(filters.max_age, max) : max;
  }

  const between = q.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (between) {
    filters.min_age = Number(between[1]);
    filters.max_age = Number(between[2]);
  }

  const countryMap = {
    nigeria: "NG",
    kenya: "KE",
    ethiopia: "ET",
    angola: "AO",
    ghana: "GH",
    uganda: "UG",
  };

  for (const key in countryMap) {
    if (q.includes(key)) {
      filters.country_id = countryMap[key];
    }
  }

  if (hasMale && hasFemale) {
    delete filters.gender;
  }

  return filters;
}