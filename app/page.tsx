import { unstable_noStore as noStore } from "next/cache";
import fs from "fs";
import PageContent from './_components/PageContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔴 OS 絶対パス（Next.js プロジェクト根の物理位置に合わせて修正してください）
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';
const DATA_EVENTS_PATH = '/root/jomon-portal/app/data/events.json';

interface Facility {
  id: string;
  name: string;
  region: string;
  prefecture: string;
  lat: number;
  lng: number;
  tags: string[];
  thumbnail?: string;
  description?: string;
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

function loadDataSync() {
  noStore();

  const _dynamicBuster = Date.now();
  console.log('[Home/loadDataSync] Cache buster:', _dynamicBuster);
  console.log('[Home/loadDataSync] Reading from:', DATA_FACILITIES_PATH);
  console.log('[Home/loadDataSync] Reading from:', DATA_EVENTS_PATH);

  try {
    const facilitiesContent = fs.readFileSync(DATA_FACILITIES_PATH, 'utf-8');
    const eventsContent = fs.readFileSync(DATA_EVENTS_PATH, 'utf-8');

    return {
      facilities: JSON.parse(facilitiesContent) as Facility[],
      events: JSON.parse(eventsContent) as JomonEvent[],
    };
  } catch (error) {
    console.error('[Home/loadDataSync] Error reading files:', error);
    return {
      facilities: [] as Facility[],
      events: [] as JomonEvent[],
    };
  }
}

export default async function Home() {
  const { facilities, events } = loadDataSync();
  return <PageContent facilitiesData={facilities} eventsData={events} />;
}
