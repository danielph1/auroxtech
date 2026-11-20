const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },

      {source: "/ficha-cliente", headers: [
        {key: "Referrer-Policy", value: "no-referrer"},
        {key: "X-Frame-Options", value: "DENY"},
        {key: "X-Robots-Tag", value: "noindex, nofollow, noarchive"},
        {key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"},
      ]},
      {source: "/api/public/ficha-cliente", headers: [
        {key: "Cache-Control", value: "no-store, private"},
        {key: "Referrer-Policy", value: "no-referrer"},
        {key: "X-Frame-Options", value: "DENY"},
        {key: "X-Robots-Tag", value: "noindex, nofollow, noarchive"},
        {key: "Access-Control-Allow-Origin", value: "https://auroxtech.vercel.app"},
        {key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'"},
      ]},
        ];
  },
};

module.exports = nextConfig;
