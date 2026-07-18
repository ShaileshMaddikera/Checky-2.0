/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: '*.amazon.com' },
    ],
  },
  webpack(config) {
    // Moss SDK is optional — resolve at runtime so build works without it installed
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      '@moss-dev/moss',
    ];
    return config;
  },
};

export default nextConfig;
