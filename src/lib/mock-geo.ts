import type { GeoEntry } from "./types";

/**
 * Realistic mock geo data for development and visual verification.
 * Used when the API returns no data and NODE_ENV === "development".
 */
export const MOCK_GEO_DATA: GeoEntry[] = [
  // North America
  { country: "US", city: "New York", lat: 40.71, lon: -74.01, count: 42 },
  { country: "US", city: "San Francisco", lat: 37.77, lon: -122.42, count: 18 },
  { country: "US", city: "Chicago", lat: 41.88, lon: -87.63, count: 11 },
  { country: "CA", city: "Toronto", lat: 43.65, lon: -79.38, count: 9 },
  { country: "CA", city: "Vancouver", lat: 49.28, lon: -123.12, count: 4 },

  // Europe
  { country: "GB", city: "London", lat: 51.51, lon: -0.13, count: 25 },
  { country: "DE", city: "Frankfurt", lat: 50.11, lon: 8.68, count: 15 },
  { country: "FR", city: "Paris", lat: 48.86, lon: 2.35, count: 14 },
  { country: "NL", city: "Amsterdam", lat: 52.37, lon: 4.90, count: 11 },
  { country: "SE", city: "Stockholm", lat: 59.33, lon: 18.07, count: 3 },
  { country: "CH", city: "Zurich", lat: 47.37, lon: 8.54, count: 5 },

  // Asia-Pacific
  { country: "JP", city: "Tokyo", lat: 35.68, lon: 139.69, count: 31 },
  { country: "KR", city: "Seoul", lat: 37.57, lon: 126.98, count: 20 },
  { country: "SG", city: "Singapore", lat: 1.35, lon: 103.82, count: 12 },
  { country: "AU", city: "Sydney", lat: -33.87, lon: 151.21, count: 8 },
  { country: "IN", city: "Mumbai", lat: 19.08, lon: 72.88, count: 7 },
  { country: "HK", count: 16 },
  { country: "TW", count: 6 },

  // South America
  { country: "BR", city: "São Paulo", lat: -23.55, lon: -46.63, count: 5 },

  // Middle East / Africa
  { country: "AE", city: "Dubai", lat: 25.20, lon: 55.27, count: 4 },
  { country: "ZA", city: "Cape Town", lat: -33.93, lon: 18.42, count: 2 },

  // Russia
  { country: "RU", city: "Moscow", lat: 55.76, lon: 37.62, count: 3 },
];

export const MOCK_SERVER_GEO = { country: "US" };
