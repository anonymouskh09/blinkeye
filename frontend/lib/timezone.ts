const LOCATION_TIMEZONE_MAP: [RegExp, string][] = [
  [/pakistan|lahore|karachi|islamabad|rawalpindi|faisalabad/i, "Asia/Karachi"],
  [/sydney|melbourne|australia/i, "Australia/Sydney"],
  [/berlin|germany|frankfurt/i, "Europe/Berlin"],
  [/london|uk|united kingdom|manchester/i, "Europe/London"],
  [/new york|nyc|manhattan|boston|philadelphia|washington/i, "America/New_York"],
  [/san francisco|los angeles|california|seattle|portland/i, "America/Los_Angeles"],
  [/chicago|dallas|houston|austin|denver/i, "America/Chicago"],
  [/toronto|montreal|vancouver|canada/i, "America/Toronto"],
  [/dubai|uae|abu dhabi|sharjah/i, "Asia/Dubai"],
  [/riyadh|saudi|jeddah|dammam/i, "Asia/Riyadh"],
  [/mumbai|delhi|bangalore|bengaluru|hyderabad|india/i, "Asia/Kolkata"],
  [/singapore/i, "Asia/Singapore"],
  [/tokyo|japan|osaka/i, "Asia/Tokyo"],
  [/paris|france|lyon/i, "Europe/Paris"],
  [/amsterdam|netherlands|rotterdam/i, "Europe/Amsterdam"],
];

export const COMMON_TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
];

export const SALARY_CURRENCIES = ["USD", "AUD", "CAD", "GBP", "EUR", "SAR", "AED", "PKR"] as const;

export function guessTimezoneFromLocation(location?: string | null): string | null {
  if (!location) return null;
  for (const [pattern, tz] of LOCATION_TIMEZONE_MAP) {
    if (pattern.test(location)) return tz;
  }
  return null;
}
