import path from "node:path";
import { fileURLToPath } from "node:url";

/** Pin Turbopack to this app when another lockfile exists higher on disk (e.g. monorepo). */
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  turbopack: {
    root: dashboardRoot
  },
  images: {
    // Disable on-server image optimization surface for this deployment.
    unoptimized: true
  }
};
export default nextConfig;
