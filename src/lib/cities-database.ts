/**
 * Cities database management for BookEx
 * Dynamic city database with MongoDB integration
 */

import { ObjectId } from 'mongodb';
import { connectToMongoDB } from './mongodb';

export interface CityDocument {
  _id?: ObjectId;
  name: string;
  country: string;
  region?: string;
  population?: number;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CityData {
  name: string;
  country: string;
  region?: string;
  population?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Get cities collection
 */
async function getCitiesCollection() {
  const { db } = await connectToMongoDB();
  return db.collection<CityDocument>('cities');
}

/**
 * Initialize cities collection with indexes
 */
export async function initializeCitiesCollection(): Promise<void> {
  try {
    const collection = await getCitiesCollection();

    // Create indexes for better performance
    await collection.createIndex({ name: 1, country: 1 }, { unique: true });
    await collection.createIndex({ country: 1 });
    await collection.createIndex({ isActive: 1 });
    await collection.createIndex({ population: -1 });
    await collection.createIndex({ name: 'text' }); // For text search

    console.log(' Cities collection initialized with indexes');
  } catch (error) {
    console.error('Failed to initialize cities collection:', error);
  }
}

/**
 * Seed the database with initial cities
 */
export async function seedCitiesDatabase(): Promise<void> {
  try {
    const collection = await getCitiesCollection();

    // Check if cities already exist
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️ Cities database already seeded with ${existingCount} cities`);
      return;
    }

    const cities: Omit<CityDocument, '_id'>[] = [
      // Pakistan cities
      { name: "Karachi", country: "Pakistan", region: "Sindh", population: 15741000, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Lahore", country: "Pakistan", region: "Punjab", population: 11126285, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Faisalabad", country: "Pakistan", region: "Punjab", population: 3203846, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Rawalpindi", country: "Pakistan", region: "Punjab", population: 2098231, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Gujranwala", country: "Pakistan", region: "Punjab", population: 2027001, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Peshawar", country: "Pakistan", region: "Khyber Pakhtunkhwa", population: 1970042, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Multan", country: "Pakistan", region: "Punjab", population: 1871843, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Hyderabad", country: "Pakistan", region: "Sindh", population: 1732693, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Islamabad", country: "Pakistan", region: "Islamabad Capital Territory", population: 1014825, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Quetta", country: "Pakistan", region: "Balochistan", population: 1001205, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Bahawalpur", country: "Pakistan", region: "Punjab", population: 762111, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sargodha", country: "Pakistan", region: "Punjab", population: 659862, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sialkot", country: "Pakistan", region: "Punjab", population: 655852, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sukkur", country: "Pakistan", region: "Sindh", population: 500000, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Larkana", country: "Pakistan", region: "Sindh", population: 490508, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sheikhupura", country: "Pakistan", region: "Punjab", population: 473129, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Rahim Yar Khan", country: "Pakistan", region: "Punjab", population: 420419, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Jhang", country: "Pakistan", region: "Punjab", population: 414131, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Dera Ghazi Khan", country: "Pakistan", region: "Punjab", population: 399064, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Gujrat", country: "Pakistan", region: "Punjab", population: 390533, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sahiwal", country: "Pakistan", region: "Punjab", population: 389605, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Wah Cantonment", country: "Pakistan", region: "Punjab", population: 380000, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Mardan", country: "Pakistan", region: "Khyber Pakhtunkhwa", population: 358604, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Kasur", country: "Pakistan", region: "Punjab", population: 358409, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Okara", country: "Pakistan", region: "Punjab", population: 357935, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Mingaora", country: "Pakistan", region: "Khyber Pakhtunkhwa", population: 331100, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Nawabshah", country: "Pakistan", region: "Sindh", population: 279688, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Chiniot", country: "Pakistan", region: "Punjab", population: 277913, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Kotri", country: "Pakistan", region: "Sindh", population: 259358, isActive: true, createdAt: new Date(), updatedAt: new Date() },

      // International cities for future expansion
      { name: "New York", country: "United States", region: "New York", population: 8336817, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "London", country: "United Kingdom", region: "England", population: 8961989, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Toronto", country: "Canada", region: "Ontario", population: 2731571, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Dubai", country: "United Arab Emirates", region: "Dubai", population: 3331420, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Singapore", country: "Singapore", region: "Singapore", population: 5638700, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Sydney", country: "Australia", region: "New South Wales", population: 5312163, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Mumbai", country: "India", region: "Maharashtra", population: 12442373, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Bangalore", country: "India", region: "Karnataka", population: 8443675, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: "Delhi", country: "India", region: "Delhi", population: 11034555, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];

    const result = await collection.insertMany(cities);
    console.log(` Seeded cities database with ${result.insertedCount} cities`);
  } catch (error) {
    console.error('❌ Failed to seed cities database:', error);
  }
}

/**
 * Get all active cities
 */
export async function getAllCities(): Promise<CityData[]> {
  try {
    const collection = await getCitiesCollection();
    const cities = await collection.find({ isActive: true }).toArray();

    return cities.map((city: CityDocument) => ({
      name: city.name,
      country: city.country,
      region: city.region,
      population: city.population,
      latitude: city.latitude,
      longitude: city.longitude,
    }));
  } catch (error) {
    console.error('Error getting all cities:', error);
    return [];
  }
}

/**
 * Check if a city is valid (exists and active)
 */
export async function isValidCity(cityName: string): Promise<boolean> {
  if (!cityName || typeof cityName !== 'string') {
    return false;
  }

  try {
    const collection = await getCitiesCollection();
    const normalizedInput = cityName.trim().toLowerCase();

    const city = await collection.findOne({
      name: { $regex: new RegExp(`^${normalizedInput}$`, 'i') },
      isActive: true
    });

    return !!city;
  } catch (error) {
    console.error('Error validating city:', error);
    return false;
  }
}

/**
 * Get city data by name
 */
export async function getCityData(cityName: string): Promise<CityData | null> {
  if (!cityName || typeof cityName !== 'string') {
    return null;
  }

  try {
    const collection = await getCitiesCollection();
    const normalizedInput = cityName.trim().toLowerCase();

    const city = await collection.findOne({
      name: { $regex: new RegExp(`^${normalizedInput}$`, 'i') },
      isActive: true
    });

    if (!city) return null;

    return {
      name: city.name,
      country: city.country,
      region: city.region,
      population: city.population,
      latitude: city.latitude,
      longitude: city.longitude,
    };
  } catch (error) {
    console.error('Error getting city data:', error);
    return null;
  }
}

/**
 * Get cities by country
 */
export async function getCitiesByCountry(country: string): Promise<CityData[]> {
  if (!country || typeof country !== 'string') {
    return [];
  }

  try {
    const collection = await getCitiesCollection();
    const cities = await collection.find({
      country: { $regex: new RegExp(`^${country.trim()}$`, 'i') },
      isActive: true
    }).toArray();

    return cities.map((city: CityDocument) => ({
      name: city.name,
      country: city.country,
      region: city.region,
      population: city.population,
      latitude: city.latitude,
      longitude: city.longitude,
    }));
  } catch (error) {
    console.error('Error getting cities by country:', error);
    return [];
  }
}

/**
 * Get all available countries
 */
export async function getAvailableCountries(): Promise<string[]> {
  try {
    const collection = await getCitiesCollection();
    const countries = await collection.distinct('country', { isActive: true });
    return countries.sort();
  } catch (error) {
    console.error('Error getting available countries:', error);
    return [];
  }
}

/**
 * Search cities by partial name match
 */
export async function searchCities(query: string, limit: number = 10): Promise<CityData[]> {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  try {
    const collection = await getCitiesCollection();
    const cities = await collection.find({
      name: { $regex: normalizedQuery, $options: 'i' },
      isActive: true
    })
    .sort({ population: -1 })
    .limit(limit)
    .toArray();

    return cities.map((city: CityDocument) => ({
      name: city.name,
      country: city.country,
      region: city.region,
      population: city.population,
      latitude: city.latitude,
      longitude: city.longitude,
    }));
  } catch (error) {
    console.error('Error searching cities:', error);
    return [];
  }
}

/**
 * Get popular cities by population
 */
export async function getPopularCities(limit: number = 20): Promise<CityData[]> {
  try {
    const collection = await getCitiesCollection();
    const cities = await collection.find({ isActive: true })
      .sort({ population: -1 })
      .limit(limit)
      .toArray();

    return cities.map((city: CityDocument) => ({
      name: city.name,
      country: city.country,
      region: city.region,
      population: city.population,
      latitude: city.latitude,
      longitude: city.longitude,
    }));
  } catch (error) {
    console.error('Error getting popular cities:', error);
    return [];
  }
}

/**
 * Add a new city (admin function)
 */
export async function addCity(cityData: Omit<CityData, 'name' | 'country'> & { name: string; country: string }): Promise<boolean> {
  try {
    const collection = await getCitiesCollection();

    // Check if city already exists
    const existing = await collection.findOne({
      name: { $regex: new RegExp(`^${cityData.name.trim()}$`, 'i') },
      country: { $regex: new RegExp(`^${cityData.country.trim()}$`, 'i') }
    });

    if (existing) {
      console.log('City already exists');
      return false;
    }

    const newCity: Omit<CityDocument, '_id'> = {
      ...cityData,
      name: cityData.name.trim(),
      country: cityData.country.trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newCity);
    return result.acknowledged;
  } catch (error) {
    console.error('Error adding city:', error);
    return false;
  }
}

/**
 * Update city information (admin function)
 */
export async function updateCity(cityName: string, country: string, updates: Partial<CityData>): Promise<boolean> {
  try {
    const collection = await getCitiesCollection();

    const result = await collection.updateOne(
      {
        name: { $regex: new RegExp(`^${cityName.trim()}$`, 'i') },
        country: { $regex: new RegExp(`^${country.trim()}$`, 'i') }
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error updating city:', error);
    return false;
  }
}

/**
 * Deactivate a city (admin function)
 */
export async function deactivateCity(cityName: string, country: string): Promise<boolean> {
  try {
    const collection = await getCitiesCollection();

    const result = await collection.updateOne(
      {
        name: { $regex: new RegExp(`^${cityName.trim()}$`, 'i') },
        country: { $regex: new RegExp(`^${country.trim()}$`, 'i') }
      },
      {
        $set: {
          isActive: false,
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error deactivating city:', error);
    return false;
  }
}

/**
 * Get city statistics
 */
export async function getCityStats(): Promise<{
  totalCities: number;
  activeCities: number;
  countriesCount: number;
  citiesByCountry: { country: string; count: number }[];
}> {
  try {
    const collection = await getCitiesCollection();

    const [totalCities, activeCities, countries] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ isActive: true }),
      collection.distinct('country', { isActive: true })
    ]);

    // Get cities count by country
    const citiesByCountry = await collection.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    return {
      totalCities,
      activeCities,
      countriesCount: countries.length,
      citiesByCountry: citiesByCountry.map((item: any) => ({
        country: item._id,
        count: item.count
      }))
    };
  } catch (error) {
    console.error('Error getting city stats:', error);
    return {
      totalCities: 0,
      activeCities: 0,
      countriesCount: 0,
      citiesByCountry: []
    };
  }
}
