import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/siteUrl";

const base = getPublicSiteUrl();

const routes = [
  "",
  "/login",
  "/bpvp20",
  "/bpvp721",
  "/market",
  "/otc",
  "/bridge",
  "/trust",
  "/lend",
  "/settle",
  "/profile",
  "/docs"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7
  }));
}
