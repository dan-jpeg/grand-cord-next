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
