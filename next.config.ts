import type { NextConfig } from "next";

const nextConfig = {
    // Five sibling projects under grand-cord-CODE each carry a lockfile, so
    // Next infers the workspace root as the parent directory and PostCSS then
    // looks for tailwindcss there instead of here. Pin the root to this project.
    //
    // process.cwd() rather than __dirname: this config is loaded as ESM, where
    // __dirname is undefined, and a root of `undefined` silently falls back to
    // the same bad inference it is meant to override.
    turbopack: {
        root: process.cwd(),
    },
    // The invite is the homepage: / serves app/invite while the URL stays /.
    // It has to run beforeFiles, since app/(store)/page.tsx also matches / and
    // a normal rewrite only applies when no page does. The catalog page is left
    // in place but unreachable. /invite redirects to / so there is one URL.
    //
    // The rest of the store is hidden the same way: these pages redirect to the
    // invite. The cart stays open. To reopen the store, delete these redirects
    // and the rewrite below.
    async redirects() {
        return [
            { source: '/invite', destination: '/', permanent: false },
            { source: '/products/:path*', destination: '/', permanent: false },
            { source: '/checkout', destination: '/', permanent: false },
            { source: '/order/:path*', destination: '/', permanent: false },
            { source: '/sample', destination: '/', permanent: false },
        ]
    },
    async rewrites() {
        return {
            beforeFiles: [{ source: '/', destination: '/invite' }],
            afterFiles: [],
            fallback: [],
        }
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'utfs.io',
            },
        ],
    },
}

export default nextConfig;
