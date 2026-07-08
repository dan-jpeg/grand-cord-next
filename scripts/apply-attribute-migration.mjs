import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const sql = readFileSync(
  new URL('../prisma/migrations/20260621120000_add_product_attributes/migration.sql', import.meta.url),
  'utf8',
);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  await client.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (gen_random_uuid()::text, 'manual-apply', NOW(), '20260621120000_add_product_attributes', NULL, NULL, NOW(), 1)
     ON CONFLICT DO NOTHING`,
  );
  console.log('applied');
} finally {
  await client.end();
}
