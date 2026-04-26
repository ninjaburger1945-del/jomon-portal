import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const IMAGES_DIR = '/root/jomon-portal/public/images/facilities';

export async function GET() {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

    return NextResponse.json(imageFiles);
  } catch (error) {
    console.error('Failed to list images:', error);
    return NextResponse.json(
      { error: 'Failed to list images' },
      { status: 500 }
    );
  }
}
