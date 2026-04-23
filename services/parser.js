export function parseQuery(q) {
  const filters = {};

  if (!q || typeof q !== "string") return filters;

  q = q.toLowerCase();

  const hasMale = q.includes("male");
  const hasFemale = q.includes("female");

  if (hasMale && !hasFemale) filters.gender = "male";
  if (hasFemale && !hasMale) filters.gender = "female";

  if (q.includes("child")) filters.age_group = "child";
  if (q.includes("teenager")) filters.age_group = "teenager";
  if (q.includes("adult")) filters.age_group = "adult";
  if (q.includes("senior")) filters.age_group = "senior";

  if (q.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  const above = q.match(/above\s+(\d+)/);
  if (above) filters.min_age = Number(above[1]);

  const below = q.match(/below\s+(\d+)/);
  if (below) filters.max_age = Number(below[1]);

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

  if (q.includes("male and female")) {
    delete filters.gender;
  }

  return filters;
}
