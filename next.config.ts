import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lass-treffen.de" }],
        destination: "https://lass-treffen.de/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
