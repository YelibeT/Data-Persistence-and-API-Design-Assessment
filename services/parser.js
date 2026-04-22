export function parseQuery(q) {
  let filters = {};

  // gender
  if (q.includes("male")) filters.gender = "male";
  if (q.includes("female")) filters.gender = "female";

  // age
  if (q.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  if (q.includes("teenager")) filters.age_group = "teenager";
  if (q.includes("adult")) filters.age_group = "adult";

  const aboveMatch = q.match(/above (\d+)/);
  if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]);

  const belowMatch = q.match(/below (\d+)/);
  if (belowMatch) filters.max_age = parseInt(belowMatch[1]);

  // country
  const countryMap = {
    nigeria: "NG",
    kenya: "KE",
    angola: "AO",
  };

  for (const [name, code] of Object.entries(countryMap)) {
    if (q.includes(name)) {
      filters.country_id = code;
    }
  }

  return filters;
}
