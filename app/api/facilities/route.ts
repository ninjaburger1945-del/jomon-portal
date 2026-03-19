import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'app/data/facilities.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const facilities = JSON.parse(fileContent);

    return NextResponse.json(facilities);
  } catch (error) {
    console.error('Failed to load facilities:', error);
    return NextResponse.json(
      { error: 'Failed to load facilities' },
      { status: 500 }
    );
  }
}
