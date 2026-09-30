import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: Turbopack reuses stable chunk filenames, so a browser can serve a
  // cached bundle after an edit and show stale UI. no-store rules that out.
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
