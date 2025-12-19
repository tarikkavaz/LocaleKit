import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Use static export for Tauri, but API routes work in dev mode
  output: process.env.TAURI_BUILD ? "export" : undefined,
  distDir: process.env.TAURI_BUILD ? "out" : ".next",
  images: {
    unoptimized: true,
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
