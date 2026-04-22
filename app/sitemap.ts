import { MetadataRoute } from "next";
import { readFileSync } from "fs";

export const dynamic = "force-dynamic";

// 🔴 唯一の正解：/root/jomon-portal/app/data/facilities.json
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';
const BASE_URL = "https://jomon-portal.web.app";

export default function sitemap(): MetadataRoute.Sitemap {
  try {
    const facilitiesContent = readFileSync(DATA_FACILITIES_PATH, 'utf-8');
    const facilitiesData = JSON.parse(facilitiesContent);

    const facilityPages: MetadataRoute.Sitemap = facilitiesData.map((f: any) => ({
      url: `${BASE_URL}/facility/${f.id}/`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    return [
      {
        url: `${BASE_URL}/`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 1.0,
      },
      ...facilityPages,
    ];
  } catch (error) {
    console.error('[sitemap] Error reading facilities:', error);
    return [
      {
        url: `${BASE_URL}/`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 1.0,
      },
    ];
  }
}
