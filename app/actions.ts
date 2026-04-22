'use server';

import fs from 'fs';
import path from 'path';
import { unstable_noStore as noStore } from 'next/cache';

interface Facility {
  id: string;
  name: string;
  region: string;
  prefecture: string;
  lat: number;
  lng: number;
  tags: string[];
  thumbnail?: string;
  [key: string]: unknown;
}

interface JomonEvent {
  id: string;
  title: string;
  date_start: string;
  date_end?: string;
  time?: string;
  location?: string;
  facility_name?: string;
  prefecture?: string;
  region?: string;
  url?: string;
  category?: string;
  description?: string;
}

export async function loadData() {
  noStore();

  const facilitiesPath = path.join(process.cwd(), 'app/data/facilities.json');
  const eventsPath = path.join(process.cwd(), 'app/data/events.json');

  console.log('[loadData] process.cwd():', process.cwd());
  console.log('[loadData] facilitiesPath:', facilitiesPath);
  console.log('[loadData] eventsPath:', eventsPath);

  try {
    const facilitiesContent = fs.readFileSync(facilitiesPath, 'utf-8');
    const eventsContent = fs.readFileSync(eventsPath, 'utf-8');

    return {
      facilities: JSON.parse(facilitiesContent) as Facility[],
      events: JSON.parse(eventsContent) as JomonEvent[],
    };
  } catch (error) {
    console.error('[loadData] Error reading files:', error);
    return {
      facilities: [] as Facility[],
      events: [] as JomonEvent[],
    };
  }
}
