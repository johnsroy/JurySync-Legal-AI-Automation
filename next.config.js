/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/juryvault',
        destination: '/vault',
        permanent: true,
      },
    ];
  },
  // ... other config options
};

module.exports = nextConfig; 