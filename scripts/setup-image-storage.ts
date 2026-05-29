import { mkdir } from 'fs/promises';
import { getImageStorageRoot, IMAGE_STORAGE_CATEGORIES } from '../src/lib/image-storage';

async function main() {
  const root = getImageStorageRoot();

  await mkdir(root, { recursive: true, mode: 0o755 });
  for (const category of IMAGE_STORAGE_CATEGORIES) {
    await mkdir(`${root}/${category}`, { recursive: true, mode: 0o755 });
  }
  await mkdir(`${root}/temp/quarantine`, { recursive: true, mode: 0o755 });

  console.log(`Image storage directories ensured at ${root}`);
  console.log('If the app user cannot write to the root, run: sudo chown -R <app-user>:<app-group> ' + root);
}

main().catch((error) => {
  console.error('Failed to initialize image storage directories:', error);
  process.exit(1);
});
