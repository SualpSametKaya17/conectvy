/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron production build için standalone server gerekli.
  // "standalone" sadece `next build` çıktısını etkiler, `next dev`'i etkilemez.
  output: "standalone",

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
