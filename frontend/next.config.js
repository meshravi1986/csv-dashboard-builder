/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://csv-dashboard-builder-production.up.railway.app/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
