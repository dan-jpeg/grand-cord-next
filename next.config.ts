import type { NextConfig } from "next";
import path from "node:path";

const nextConfig = {
    // Five sibling projects under grand-cord-CODE each carry a lockfile, so
    // Next infers the workspace root as the parent directory and PostCSS then
    // looks for tailwindcss there instead of here. Pin the root to this project.
    turbopack: {
        root: path.resolve(__dirname),
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
