import crypto from 'crypto';
import path from 'path';
import { mkdir, access, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import { EJSON } from 'bson';
import { fileTypeFromBuffer } from 'file-type';
import { getImageStorageRoot, IMAGE_STORAGE_CATEGORIES, isImagePublicUrl } from '../src/lib/image-storage';

type TargetField = {
  field: string;
  category: (typeof IMAGE_STORAGE_CATEGORIES)[number];
};

type TargetCollection = {
  name: string;
  fields: TargetField[];
};

const TARGET_COLLECTIONS: TargetCollection[] = [
  {
    name: 'users',
    fields: [{ field: 'avatarUrl', category: 'profiles' }],
  },
  {
    name: 'books',
    fields: [{ field: 'imageUrl', category: 'books' }],
  },
  {
    name: 'communities',
    fields: [
      { field: 'imageUrl', category: 'communities' },
      { field: 'coverImage', category: 'communities' },
    ],
  },
  {
    name: 'organizations',
    fields: [{ field: 'imageUrl', category: 'communities' }],
  },
];

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'bookex';
const BACKUP_ROOT = process.env.BOOKEX_IMAGE_BACKUP_DIR || path.resolve(process.cwd(), 'backups', 'image-storage');
const UPLOAD_ROOT = getImageStorageRoot();

function detectMimeFromBuffer(buffer: Buffer, fallbackExtension?: string): { mimeType: string; extension: string } {
  const extension = (fallbackExtension || '').toLowerCase();
  const fallbackMap: Record<string, { mimeType: string; extension: string }> = {
    '.jpg': { mimeType: 'image/jpeg', extension: '.jpg' },
    '.jpeg': { mimeType: 'image/jpeg', extension: '.jpg' },
    '.png': { mimeType: 'image/png', extension: '.png' },
    '.webp': { mimeType: 'image/webp', extension: '.webp' },
  };

  const defaultType = fallbackMap[extension] || { mimeType: 'image/jpeg', extension: '.jpg' };
  return defaultType;
}

function normalizeDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const [, mimeType, base64Data] = match;
  return { mimeType, buffer: Buffer.from(base64Data, 'base64') };
}

function isBinaryLike(value: unknown): value is { _bsontype?: string; buffer?: Buffer | Uint8Array } {
  return Boolean(value && typeof value === 'object' && '_bsontype' in (value as Record<string, unknown>));
}

async function writeDeterministicImage(buffer: Buffer, category: string, mimeType: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${hash}${extension}`;
  const absolutePath = path.join(UPLOAD_ROOT, category, filename);
  const publicUrl = `/uploads/${category}/${filename}`;

  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o755 });

  try {
    await access(absolutePath, fsConstants.F_OK);
  } catch {
    await writeFile(absolutePath, buffer, { mode: 0o644 });
  }

  return publicUrl;
}

async function backupCollection(collectionName: string, docs: unknown[]): Promise<void> {
  await mkdir(BACKUP_ROOT, { recursive: true, mode: 0o755 });
  const backupFile = path.join(BACKUP_ROOT, `${collectionName}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(backupFile, EJSON.stringify(docs, null, 2), 'utf8');
  console.log(`Backed up ${collectionName} to ${backupFile}`);
}

async function migrateCollection(client: MongoClient, collectionName: string, fields: TargetField[]): Promise<{ scanned: number; migrated: number }> {
  const db = client.db(DATABASE_NAME);
  const collection = db.collection(collectionName);
  const docs = await collection.find({}).toArray();

  const relevantDocs = docs.filter((doc) => fields.some(({ field }) => {
    const value = (doc as Record<string, unknown>)[field];
    return typeof value === 'string' && (value.startsWith('data:image/') || isImagePublicUrl(value)) || isBinaryLike(value);
  }));

  if (relevantDocs.length > 0) {
    await backupCollection(collectionName, relevantDocs);
  }

  let migrated = 0;

  for (const doc of docs) {
    const update: Record<string, unknown> = {};
    let hasUpdate = false;

    for (const { field, category } of fields) {
      const currentValue = (doc as Record<string, unknown>)[field];

      if (typeof currentValue === 'string') {
        if (currentValue.startsWith('data:image/')) {
          const normalized = normalizeDataUri(currentValue);
          if (!normalized) continue;

          const imageType = normalized.mimeType;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageType)) {
            continue;
          }

          const publicUrl = await writeDeterministicImage(normalized.buffer, category, imageType);
          update[field] = publicUrl;
          hasUpdate = true;
        }
        continue;
      }

      if (isBinaryLike(currentValue)) {
        const buffer = Buffer.from(currentValue.buffer as Buffer | Uint8Array);
        const detected = await fileTypeFromBuffer(buffer);
        const mimeType = detected?.mime || detectMimeFromBuffer(buffer).mimeType;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          continue;
        }

        const publicUrl = await writeDeterministicImage(buffer, category, mimeType);
        update[field] = publicUrl;
        hasUpdate = true;
      }
    }

    if (hasUpdate) {
      await collection.updateOne(
        { _id: new ObjectId(String((doc as { _id: ObjectId })._id)) },
        { $set: update }
      );
      migrated += 1;
    }
  }

  return { scanned: docs.length, migrated };
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    await mkdir(path.join(UPLOAD_ROOT, 'books'), { recursive: true, mode: 0o755 });
    await mkdir(path.join(UPLOAD_ROOT, 'profiles'), { recursive: true, mode: 0o755 });
    await mkdir(path.join(UPLOAD_ROOT, 'communities'), { recursive: true, mode: 0o755 });
    await mkdir(path.join(UPLOAD_ROOT, 'temp', 'quarantine'), { recursive: true, mode: 0o755 });

    for (const target of TARGET_COLLECTIONS) {
      const result = await migrateCollection(client, target.name, target.fields);
      console.log(`${target.name}: scanned ${result.scanned}, migrated ${result.migrated}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Image storage migration failed:', error);
  process.exit(1);
});
