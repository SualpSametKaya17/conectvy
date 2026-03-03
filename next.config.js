/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Electron: static export not used; we use next start in prod
  output: process.env.ELECTRON_BUILD === "1" ? "standalone" : undefined,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
