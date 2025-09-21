/**
 * City validation and database for BookEx
 * Dynamic city database with MongoDB integration
 */

import {
  isValidCity as dbIsValidCity,
  getCityData as dbGetCityData,
  getCitiesByCountry as dbGetCitiesByCountry,
  getAvailableCountries as dbGetAvailableCountries,
  searchCities as dbSearchCities,
  getPopularCities as dbGetPopularCities,
  initializeCitiesCollection,
  seedCitiesDatabase
} from './cities-database';

export interface CityData {
  name: string;
  country: string;
  region?: string;
  population?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Validates if a city name exists in our database
 */
export async function isValidCity(cityName: string): Promise<boolean> {
  return await dbIsValidCity(cityName);
}

/**
 * Gets city data by name
 */
export async function getCityData(cityName: string): Promise<CityData | null> {
  return await dbGetCityData(cityName);
}

/**
 * Gets all cities for a specific country
 */
export async function getCitiesByCountry(country: string): Promise<CityData[]> {
  return await dbGetCitiesByCountry(country);
}

/**
 * Gets all available countries
 */
export async function getAvailableCountries(): Promise<string[]> {
  return await dbGetAvailableCountries();
}

/**
 * Searches cities by partial name match
 */
export async function searchCities(query: string, limit: number = 10): Promise<CityData[]> {
  return await dbSearchCities(query, limit);
}

/**
 * Validates city for user profile (must be in our database)
 */
export async function validateUserCity(cityName: string): Promise<{ isValid: boolean; error?: string; cityData?: CityData }> {
  if (!cityName || typeof cityName !== 'string' || cityName.trim().length === 0) {
    return { isValid: false, error: 'City is required' };
  }

  const cityData = await getCityData(cityName);
  if (!cityData) {
    return {
      isValid: false,
      error: 'Please select a valid city from the list'
    };
  }

  return { isValid: true, cityData };
}

/**
 * Gets popular cities (by population) for quick selection
 */
export async function getPopularCities(limit: number = 20): Promise<CityData[]> {
  return await dbGetPopularCities(limit);
}

/**
 * Initialize cities database (call this on application startup)
 */
export async function initializeCities(): Promise<void> {
  await initializeCitiesCollection();
  await seedCitiesDatabase();
}

/**
 * Get all cities (for admin purposes)
 */
export async function getAllCities(): Promise<CityData[]> {
  const { getAllCities: dbGetAllCities } = await import('./cities-database');
  return await dbGetAllCities();
}
