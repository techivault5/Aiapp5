/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['snowflake-sdk', 'node-forge'],
  },
};

module.exports = nextConfig;
