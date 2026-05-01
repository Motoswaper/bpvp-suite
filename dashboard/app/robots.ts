import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/"
      }
    ],
    sitemap: `${origin}/sitemap.xml`
  };
}
