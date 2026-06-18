/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nrep.ug',
      },
    ],
  },
};

module.exports = nextConfig;
