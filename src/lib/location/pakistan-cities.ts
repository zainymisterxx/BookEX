import type { CityRecord } from './location-types';

// Minimal canonical Pakistani cities list used as a fallback and reference.
// The authoritative source remains the cities collection in MongoDB (cities-database.ts).

const cities: CityRecord[] = [
  { code: 'KHI', name: 'Karachi', province: 'Sindh', normalized: 'karachi', enabled: true, latitude: 24.8607, longitude: 67.0011 },
  { code: 'LHE', name: 'Lahore', province: 'Punjab', normalized: 'lahore', enabled: true, latitude: 31.5204, longitude: 74.3587 },
  { code: 'ISB', name: 'Islamabad', province: 'Islamabad Capital Territory', normalized: 'islamabad', enabled: true, latitude: 33.6844, longitude: 73.0479 },
  { code: 'RWP', name: 'Rawalpindi', province: 'Punjab', normalized: 'rawalpindi', enabled: true, latitude: 33.5651, longitude: 73.0169 },
  { code: 'FSD', name: 'Faisalabad', province: 'Punjab', normalized: 'faisalabad', enabled: true, latitude: 31.4504, longitude: 73.1350 },
  { code: 'MUX', name: 'Multan', province: 'Punjab', normalized: 'multan', enabled: true, latitude: 30.1978, longitude: 71.4711 },
  { code: 'PEW', name: 'Peshawar', province: 'Khyber Pakhtunkhwa', normalized: 'peshawar', enabled: true, latitude: 34.0151, longitude: 71.5249 },
  { code: 'KQT', name: 'Quetta', province: 'Balochistan', normalized: 'quetta', enabled: true, latitude: 30.1798, longitude: 66.9750 },
  { code: 'GJW', name: 'Gujranwala', province: 'Punjab', normalized: 'gujranwala', enabled: true, latitude: 32.1877, longitude: 74.1945 },
  { code: 'SKT', name: 'Sialkot', province: 'Punjab', normalized: 'sialkot', enabled: true, latitude: 32.4945, longitude: 74.5229 },
  { code: 'HDD', name: 'Hyderabad', province: 'Sindh', normalized: 'hyderabad', enabled: true, latitude: 25.3960, longitude: 68.3578 },
  { code: 'BAW', name: 'Bahawalpur', province: 'Punjab', normalized: 'bahawalpur', enabled: true, latitude: 29.3956, longitude: 71.6836 },
  { code: 'SRG', name: 'Sargodha', province: 'Punjab', normalized: 'sargodha', enabled: true, latitude: 32.0837, longitude: 72.6711 },
  { code: 'ABT', name: 'Abbottabad', province: 'Khyber Pakhtunkhwa', normalized: 'abbottabad', enabled: true, latitude: 34.1688, longitude: 73.2215 },
  { code: 'SKR', name: 'Sukkur', province: 'Sindh', normalized: 'sukkur', enabled: true, latitude: 27.7052, longitude: 68.8573 },
  { code: 'MZD', name: 'Muzaffarabad', province: 'Azad Kashmir', normalized: 'muzaffarabad', enabled: true, latitude: 34.3697, longitude: 73.4718 },
  { code: 'GLT', name: 'Gilgit', province: 'Gilgit-Baltistan', normalized: 'gilgit', enabled: true, latitude: 35.9187, longitude: 74.3120 }
];

export default cities;
