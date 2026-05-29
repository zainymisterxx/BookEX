const { default: clientPromise } = await import('../../src/lib/mongodb');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || !args.has('--apply');
const applyChanges = args.has('--apply');
const rollbackPathArgIndex = process.argv.findIndex(arg => arg === '--rollback-out');
const rollbackOutPath = rollbackPathArgIndex >= 0 ? process.argv[rollbackPathArgIndex + 1] : path.join(__dirname, 'normalize-cities-rollback.json');
const reportPath = path.join(__dirname, 'normalize-cities-report.json');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function normalizeCollection(collection, locationUtils, label) {
  const cursor = collection.find({});
  const reportEntries = [];
  const rollbackEntries = [];
  let scanned = 0;
  let migrated = 0;
  let alreadyNormalized = 0;
  let unmapped = 0;
  let risky = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;

    const rawCity = typeof doc.city === 'string' ? doc.city.trim() : '';
    const currentNormalized = typeof doc.cityNormalized === 'string' ? doc.cityNormalized.trim() : '';

    const matched = rawCity ? await locationUtils.mapLegacyCity(rawCity) : { matched: null };
    const canonical = matched.matched;
    const targetNormalized = canonical?.normalized || currentNormalized || '';
    const targetName = canonical?.name || null;

    const hasRawCity = rawCity.length > 0;
    const hasNormalized = currentNormalized.length > 0;
    const canNormalize = Boolean(targetNormalized);
    const normalizedMatches = canNormalize && hasNormalized && currentNormalized === targetNormalized;

    if (hasRawCity && canNormalize && (!hasNormalized || !normalizedMatches)) {
      if (!dryRun) {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: { cityNormalized: targetNormalized },
            $unset: { city: '' }
          }
        );
      }

      migrated += 1;
      rollbackEntries.push({
        collection: label,
        _id: doc._id.toString(),
        city: doc.city ?? null,
        cityNormalized: doc.cityNormalized ?? null,
        nextCityNormalized: targetNormalized
      });
      reportEntries.push({
        _id: doc._id.toString(),
        original: rawCity,
        mapped: targetNormalized,
        cityName: targetName,
        action: hasNormalized ? 'replaced-raw-and-normalized' : 'normalized-and-unset-raw'
      });
      continue;
    }

    if (hasRawCity && !canNormalize) {
      unmapped += 1;
      risky += 1;
      rollbackEntries.push({
        collection: label,
        _id: doc._id.toString(),
        city: doc.city ?? null,
        cityNormalized: doc.cityNormalized ?? null,
        nextCityNormalized: null
      });
      reportEntries.push({
        _id: doc._id.toString(),
        original: rawCity,
        mapped: null,
        cityName: null,
        action: 'unmapped'
      });
      continue;
    }

    if (hasNormalized && !hasRawCity) {
      alreadyNormalized += 1;
      reportEntries.push({
        _id: doc._id.toString(),
        original: null,
        mapped: currentNormalized,
        cityName: targetName,
        action: 'already-normalized'
      });
      continue;
    }

    if (!hasRawCity && !hasNormalized) {
      risky += 1;
      reportEntries.push({
        _id: doc._id.toString(),
        original: null,
        mapped: null,
        cityName: null,
        action: 'missing-city'
      });
    }
  }

  return {
    reportEntries,
    rollbackEntries,
    summary: {
      scanned,
      migrated,
      alreadyNormalized,
      unmapped,
      risky
    }
  };
}

async function run() {
  const client = await clientPromise;
  const db = client.db('bookex');
  const users = db.collection('users');
  const books = db.collection('books');

  const { default: locationUtils } = await import('../../src/lib/location/location-utils.ts');

  const userResult = await normalizeCollection(users, locationUtils, 'users');
  const bookResult = await normalizeCollection(books, locationUtils, 'books');

  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    generatedAt: new Date().toISOString(),
    summary: {
      users: userResult.summary,
      books: bookResult.summary,
      totalScanned: userResult.summary.scanned + bookResult.summary.scanned,
      totalMigrated: userResult.summary.migrated + bookResult.summary.migrated,
      totalUnmapped: userResult.summary.unmapped + bookResult.summary.unmapped,
      totalRisky: userResult.summary.risky + bookResult.summary.risky
    },
    users: userResult.reportEntries,
    books: bookResult.reportEntries
  };

  writeJson(reportPath, report);
  writeJson(rollbackOutPath, {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    changes: [...userResult.rollbackEntries, ...bookResult.rollbackEntries]
  });

  console.log(`City normalization ${dryRun ? 'dry-run' : 'apply'} completed.`);
  console.log(`Report written to ${reportPath}`);
  console.log(`Rollback snapshot written to ${rollbackOutPath}`);

  if (dryRun) {
    console.log('No database writes were performed. Re-run with --apply to execute changes.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
