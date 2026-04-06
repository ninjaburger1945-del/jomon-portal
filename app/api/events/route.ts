import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const revalidate = 0; // キャッシュなし（常に最新データ）

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'app/data/events.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const events = JSON.parse(fileContents);

    return NextResponse.json(events);
  } catch (error) {
    console.error('[api/events]', error);
    return NextResponse.json(
      { error: 'Failed to load events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
