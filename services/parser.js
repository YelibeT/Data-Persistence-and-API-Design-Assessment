export function parseQuery(q) {
  let filters = {};

  // gender
  if (q.includes("male")) filters.gender = "male";
  if (q.includes("female")) filters.gender = "female";


  if (q.includes("teenager")) filters.age_group = "teenager";
  if (q.includes("adult")) filters.age_group = "adult";
  if (q.includes("adult")) filters.age_group = "child";
  if (q.includes("adult")) filters.age_group = "senior";

  if (q.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }
  const above = q.match(/above (\d+)/);
  if (above) filters.min_age = Number(above[1]);

  // below X
  const below = q.match(/below (\d+)/);
  if (below) filters.max_age = Number(below[1]);

  // country
  const countryMap = {
    nigeria: "NG",
    kenya: "KE",
    angola: "AO",
    ethiopia:"ET"
  };

  for (let key in countryMap) {
    if (q.includes(key)) {
      filters.country_id = countryMap[key];
    }
  }
  if (Object.keys(filters).length === 0) {
  return res.status(422).json({
    status: "error",
    message: "Unable to interpret query"
  });
}

  return filters;
}
