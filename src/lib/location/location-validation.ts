import locationUtils from './location-utils';

/**
 * Validate user city and return canonical name
 */
export async function validateUserCityCanonical(city: unknown): Promise<{ isValid: boolean; error?: string; city?: { name: string; normalized: string } }> {
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    return { isValid: false, error: 'City is required' };
  }

  const normalized = await locationUtils.normalizeCityForStorage(city as string);
  if (!normalized) {
    return { isValid: false, error: 'Please select a valid city from the list' };
  }

  return { isValid: true, city: normalized };
}

export const makeKey = locationUtils.makeNormalizedKey;

export default {
  validateUserCityCanonical,
  makeKey
};
