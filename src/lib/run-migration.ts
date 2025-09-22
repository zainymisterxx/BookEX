/**
 * Migration runner utility
 * Run this to fix existing communities and ensure they have proper channels and member structure
 */

import { SchemaMigration } from './schema-migration';

async function runMigration() {
  console.log('🚀 Starting BookEx Community Migration...');
  
  try {
    await SchemaMigration.fixAllSchemaInconsistencies();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
