import crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { MongoClient, ObjectId } from 'mongodb';
import { fileTypeFromBuffer } from 'file-type';

type ImageCategory = 'books' | 'profiles' | 'communities';

type FieldConfig = {
  field: string;
  category: ImageCategory;
};

type CollectionConfig = {
  name: string;
  fields: FieldConfig[];
};

const COLLECTIONS: CollectionConfig[] = [
  {
    name: 'users',
    fields: [
      { field: 'avatarUrl', category: 'profiles' },
      { field: 'profileImage', category: 'profiles' },
      { field: 'image', category: 'profiles' },
    ],
  },
  {
    name: 'books',
    fields: [
      { field: 'imageUrl', category: 'books' },
      { field: 'image', category: 'books' },
      { field: 'coverImage', category: 'books' },
    ],
  },
  {
    name: 'communities',
    fields: [
      { field: 'imageUrl', category: 'communities' },
      { field: 'coverImage', category: 'communities' },
      { field: 'communityImage', category: 'communities' },
      { field: 'image', category: 'communities' },
    ],
  },
  {
    name: 'organizations',
    fields: [
      { field: 'imageUrl', category: 'communities' },
      { field: 'image', category: 'communities' },
    ],
  },
];

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://bookex:S%40bih207402@127.0.0.1:27017/admin';
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'bookex';
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || process.env.MEDIA_STORAGE_ROOT || '/var/www/bookex/uploads';
const PUBLIC_BASE_URL = (process.env.MEDIA_BASE_URL || 'https://media.farya.pk').replace(/\/+$/, '');
const BACKUP_ROOT = process.env.BOOKEX_IMAGE_BACKUP_DIR || path.join('/var/www/bookex/backups', `pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`);

function toHexId(value: unknown): string {
  if (value instanceof ObjectId) {
    return value.toHexString();
  }

  return String(value);
}

function decodeDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Data] = match;
  return { mimeType, buffer: Buffer.from(base64Data, 'base64') };
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

function isRemoteUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://');
}

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

async function ensureDirectories(): Promise<void> {
  await mkdir(path.join(UPLOAD_ROOT, 'books'), { recursive: true, mode: 0o755 });
  await mkdir(path.join(UPLOAD_ROOT, 'profiles'), { recursive: true, mode: 0o755 });
  await mkdir(path.join(UPLOAD_ROOT, 'communities'), { recursive: true, mode: 0o755 });
  await mkdir(path.join(UPLOAD_ROOT, 'temp', 'quarantine'), { recursive: true, mode: 0o755 });
  await mkdir(BACKUP_ROOT, { recursive: true, mode: 0o755 });
}

async function backupDocuments(collectionName: string, documents: unknown[]): Promise<void> {
  const backupPath = path.join(BACKUP_ROOT, `${collectionName}.json`);
  const serialized = JSON.stringify(
    documents,
    (_key, value) => (value instanceof ObjectId ? value.toHexString() : value),
    2
  );
  await writeFile(backupPath, serialized, 'utf8');
  console.log(`backup ${collectionName}: ${backupPath}`);
}

async function writeImageFile(category: ImageCategory, docId: string, field: string, buffer: Buffer, mimeType: string): Promise<{ absolutePath: string; publicUrl: string }> {
  const filename = `${toHexId(docId)}-${field}${extensionForMime(mimeType)}`;
  const absolutePath = path.join(UPLOAD_ROOT, category, filename);
  const publicUrl = `${PUBLIC_BASE_URL}/uploads/${category}/${filename}`;

  try {
    await access(absolutePath, fsConstants.F_OK);
  } catch {
    await writeFile(absolutePath, buffer, { mode: 0o644 });
  }

  return { absolutePath, publicUrl };
}

async function migrateCollection(client: MongoClient, config: CollectionConfig): Promise<number> {
  const collection = client.db(DATABASE_NAME).collection(config.name);
  const documents = await collection.find({}).toArray();
  const candidates = documents.filter((document) =>
    config.fields.some(({ field }) => isDataUri((document as Record<string, unknown>)[field]))
  );

  if (candidates.length > 0) {
    await backupDocuments(config.name, candidates);
  }

  let migrated = 0;

  for (const document of documents) {
    const id = toHexId(document._id);
    const update: Record<string, string> = {};

    for (const { field, category } of config.fields) {
      const currentValue = (document as Record<string, unknown>)[field];

      if (isRemoteUrl(currentValue)) {
        continue;
      }

      if (!isDataUri(currentValue)) {
        continue;
      }

      const decoded = decodeDataUri(currentValue);
      if (!decoded) {
        continue;
      }

      const detected = await fileTypeFromBuffer(decoded.buffer);
      const mimeType = detected?.mime || decoded.mimeType;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        console.log(`skip ${config.name}/${id}.${field}: unsupported ${mimeType}`);
        continue;
      }

      const { absolutePath, publicUrl } = await writeImageFile(category, id, field, decoded.buffer, mimeType);
      console.log(`write ${config.name}/${id}.${field}: ${absolutePath}`);
      update[field] = publicUrl;
    }

    if (Object.keys(update).length > 0) {
      await collection.updateOne({ _id: document._id }, { $set: update });
      console.log(`update ${config.name}/${id}: ${Object.keys(update).join(', ')}`);
      migrated += 1;
    }
  }

  console.log(`${config.name}: migrated ${migrated}/${documents.length}`);
  return migrated;
}

async function main(): Promise<void> {
  await ensureDirectories();

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    for (const config of COLLECTIONS) {
      await migrateCollection(client, config);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('media image migration failed:', error);
  process.exit(1);
});