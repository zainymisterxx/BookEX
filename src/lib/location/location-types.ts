export interface CityRecord {
  code: string; // short code or slug, e.g. LHE
  name: string; // Canonical display name, e.g. Lahore
  province: string; // Province name, e.g. Punjab
  normalized: string; // Normalized key, e.g. lahore
  enabled: boolean; // Active for selection
  latitude?: number;
  longitude?: number;
}

export type CityMap = Record<string, CityRecord>;

export interface MigrationReportEntry {
  original: string;
  matched?: CityRecord | null;
  reason?: string;
}
