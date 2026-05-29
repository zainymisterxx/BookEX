import citiesFallback from './pakistan-cities';
import type { CityRecord, MigrationReportEntry } from './location-types';
import * as cityDb from '@/lib/cities-database';

function normalizeInputKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export async function findCanonicalCity(value: string): Promise<CityRecord | null> {
  if (!value || typeof value !== 'string') return null;

  // Try DB lookup first (best source of truth)
  try {
    const data = await cityDb.getCityData(value);
    if (data && data.name) {
      return {
        code: (data.name || '').substring(0,3).toUpperCase(),
        name: data.name,
        province: data.region || '',
        normalized: normalizeInputKey(data.name),
        enabled: true,
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }
  } catch (err) {
    // fall through to fallback
  }

  // Fallback: local list
  const needle = normalizeInputKey(value);
  const fallback = citiesFallback.find(c => c.normalized === needle || c.code.toLowerCase() === needle);
  if (fallback) return fallback;

  // Try loose matches (startsWith)
  const loose = citiesFallback.find(c => c.normalized.startsWith(needle) || c.name.toLowerCase().includes(value.toLowerCase()));
  if (loose) return loose;

  return null;
}

export async function normalizeCityForStorage(value: string): Promise<{ name: string; normalized: string } | null> {
  const match = await findCanonicalCity(value);
  if (!match) return null;
  return { name: match.name, normalized: match.normalized };
}

export async function mapLegacyCity(value: string): Promise<MigrationReportEntry> {
  const matched = await findCanonicalCity(value);
  return {
    original: value,
    matched: matched || null,
    reason: matched ? 'mapped' : 'unmatched'
  };
}

export function makeNormalizedKey(name: string): string {
  return normalizeInputKey(name);
}

// Exchange eligibility helpers will be attached here for now (can be refactored later)
import type { User, Book, Exchange } from '@/lib/types';

export function getProfileCompleteness(user: Partial<User> & { listingsCount?: number }) {
  const requirements = [
    { key: 'city', ok: !!user.cityNormalized },
    { key: 'avatarUrl', ok: !!user.avatarUrl },
    { key: 'bio', ok: !!user.bio },
    { key: 'hasListing', ok: (user.listingsCount || 0) > 0 }
  ];
  const met = requirements.filter(r => r.ok).length;
  const percent = Math.round((met / requirements.length) * 100);
  const missing = requirements.filter(r => !r.ok).map(r => r.key);
  return { percent, missing, isComplete: missing.length === 0 };
}

export function computeProfileCompleteness(user: Partial<User> & { listingsCount?: number }) {
  return getProfileCompleteness(user);
}

export function isProfileComplete(user: Partial<User> & { listingsCount?: number }) {
  return getProfileCompleteness(user).isComplete;
}

export function getExchangeBlockReason({ proposer, responder, proposerBook, responderBook }: {
  proposer: Partial<User>;
  responder: Partial<User>;
  proposerBook: Partial<Book>;
  responderBook: Partial<Book>;
}): string | null {
  // same city - require normalized keys
  if (!proposer.cityNormalized || !responder.cityNormalized) return 'Both users must set their city';
  if (proposer.cityNormalized !== responder.cityNormalized) return 'Users must be in the same city';

  // not same user
  if (proposer.id && responder.id && proposer.id === responder.id) return 'Cannot exchange with yourself';

  // own listing
  if (proposerBook.sellerId && proposerBook.sellerId !== proposer.id) return 'Proposer does not own proposer book';
  if (responderBook.sellerId && responderBook.sellerId !== responder.id) return 'Responder does not own responder book';

  // book active
  if (proposerBook.status !== 'active') return 'Proposer book is not active';
  if (responderBook.status !== 'active') return 'Responder book is not active';

  // profile completeness (basic)
  const proposerCompleteness = computeProfileCompleteness({ ...proposer });
  const responderCompleteness = computeProfileCompleteness({ ...responder });
  if (!proposerCompleteness.isComplete) return 'Proposer profile incomplete';
  if (!responderCompleteness.isComplete) return 'Responder profile incomplete';

  return null;
}

export function canUserExchange(args: Parameters<typeof getExchangeBlockReason>[0]): { allowed: boolean; reason?: string } {
  const reason = getExchangeBlockReason(args);
  return { allowed: reason === null, reason: reason || undefined };
}

export default {
  findCanonicalCity,
  normalizeCityForStorage,
  mapLegacyCity,
  makeNormalizedKey,
  getProfileCompleteness,
  computeProfileCompleteness,
  isProfileComplete,
  getExchangeBlockReason,
  canUserExchange
};
