import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE } from "@/constants/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [""];

  return routes.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: `${SITE.url}${locale === routing.defaultLocale ? "" : `/${locale}`}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  );
}
