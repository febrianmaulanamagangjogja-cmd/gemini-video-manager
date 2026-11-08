import { testConnection } from './database/db.js';
import { runMigrations } from './database/migrate.js';

async function main() {
  console.log('Testing database connection...');
  const result = await testConnection();
  
  if (result.success) {
    console.log('✓', result.message);
    console.log('\nRunning migrations...');
    await runMigrations();
    console.log('✓ Migrations completed successfully');
  } else {
    console.error('✗', result.message);
    process.exit(1);
  }

  process.exit(0);
}

main();