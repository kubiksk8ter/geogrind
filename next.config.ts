import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Only the release packaging (deploy/package-release.sh) needs the self-contained server;
// `npm run build` and `npm start` stay as they are.
const standalone = process.env.GEOGRIND_STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(standalone && { output: "standalone" }),
};

export default withNextIntl(nextConfig);
