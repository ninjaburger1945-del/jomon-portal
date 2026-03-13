import { MetadataRoute } from "next";

export const dynamic = "force-static";
import facilitiesData from "./data/facilities.json";

const BASE_URL = "https://jomon-portal.web.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const facilityPages: MetadataRoute.Sitemap = facilitiesData.map((f) => ({
    url: `${BASE_URL}/facility/${f.id}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...facilityPages,
  ];
}
