export function parseQuery(q) {
  const filters = {};
  if (!q || typeof q !== "string") return filters;

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

  const aboveMatch = query.match(/above\s+(\d+)/);
  if (aboveMatch) {
    const min = Number(aboveMatch[1]) + 1;
    filters.min_age = filters.min_age ? Math.max(filters.min_age, min) : min;
  }

  const belowMatch = query.match(/below\s+(\d+)/);
  if (belowMatch) {
    const max = Number(belowMatch[1]) - 1;
    filters.max_age = filters.max_age ? Math.min(filters.max_age, max) : max;
  }

  const countryMap = { 
    nigeria: "NG", kenya: "KE", ethiopia: "ET", 
    ghana: "GH", uganda: "UG", angola: "AO" 
  };
  
  for (const [name, id] of Object.entries(countryMap)) {
    if (query.includes(name)) filters.country_id = id;
  }

  return filters;
}