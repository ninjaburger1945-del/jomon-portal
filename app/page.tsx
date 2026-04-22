import { unstable_noStore as noStore } from "next/cache";
import fs from "fs";
import path from "path";
import PageContent from './_components/PageContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const facilitiesPath = path.join(process.cwd(), 'app/data/facilities.json');
  const eventsPath = path.join(process.cwd(), 'app/data/events.json');

  console.log('[Home/loadDataSync] process.cwd():', process.cwd());
  console.log('[Home/loadDataSync] facilitiesPath:', facilitiesPath);
  console.log('[Home/loadDataSync] eventsPath:', eventsPath);

  const facilitiesContent = fs.readFileSync(facilitiesPath, 'utf-8');
  const eventsContent = fs.readFileSync(eventsPath, 'utf-8');

  return {
    facilities: JSON.parse(facilitiesContent) as Facility[],
    events: JSON.parse(eventsContent) as JomonEvent[],
  };
}

export default async function Home() {
  const { facilities, events } = loadDataSync();
  return <PageContent facilitiesData={facilities} eventsData={events} />;
}
