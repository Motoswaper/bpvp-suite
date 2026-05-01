const nextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    // Disable on-server image optimization surface for this deployment.
    unoptimized: true
  }
};
export default nextConfig;
