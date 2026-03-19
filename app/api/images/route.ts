import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public/images/facilities');

    if (!fs.existsSync(imagesDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(imagesDir);
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
