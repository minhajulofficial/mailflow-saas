/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@inngest/inngest"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
