import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Only the Prisma CLI reads this datasource — migrations and introspection. The
 * runtime client builds its own pg adapter from DATABASE_URL in lib/prisma.ts
 * and goes on using the pooler.
 *
 * Migrations need the direct 5432 connection: the migration engine cannot take
 * its advisory lock through Supabase's pgbouncer, so pointing it at the 6543
 * pooler makes `migrate` hang indefinitely rather than fail.
 *
 * Resolved with process.env rather than Prisma's env() helper, which throws on a
 * missing variable. `prisma generate` loads this file but needs no database at
 * all, so throwing here breaks builds in environments that only set
 * DATABASE_URL — as it did on Vercel. Falling back keeps generate working;
 * `migrate` is the only command that actually depends on getting the direct URL,
 * and it will hang on the pooler if DIRECT_URL is absent. Set DIRECT_URL
 * anywhere you run migrations.
 */
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: migrationUrl,
    },
})
