import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        // Migrations and introspection only — the CLI is the sole consumer of
        // this datasource. The runtime client builds its own pg adapter from
        // DATABASE_URL in lib/prisma.ts and keeps using the pooler.
        //
        // This has to be the direct 5432 connection: Prisma's migration engine
        // cannot take its advisory lock through Supabase's pgbouncer, so
        // pointing it at the 6543 pooler makes `migrate` hang rather than fail.
        url: env('DIRECT_URL'),
    },
})