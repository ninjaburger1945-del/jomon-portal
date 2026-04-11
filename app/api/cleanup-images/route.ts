import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // 5 minutes timeout for large cleanups

async function getDirectoryContents(token: string, repo: string, dir: string) {
  const url = `https://api.github.com/repos/${repo}/contents/${dir}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch ${dir}: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function deleteFile(
  token: string,
  repo: string,
  filePath: string,
  sha: string
) {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: 'chore(images): cleanup unused deep remaster images',
      sha: sha,
      branch: 'main',
    }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(
      `Failed to delete ${filePath}: ${res.status} - ${JSON.stringify(errData)}`
    );
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;

    if (!token || !repo) {
      console.error('[cleanup-images] Missing GitHub credentials');
      return NextResponse.json(
        { error: 'GitHub credentials not configured' },
        { status: 400 }
      );
    }

    console.log('[cleanup-images] Starting cleanup...');

    // Get facilities.json from GitHub (latest version)
    console.log('[cleanup-images] Fetching latest facilities.json from GitHub...');
    const facilitiesUrl = `https://api.github.com/repos/${repo}/contents/app/data/facilities.json`;
    const facilitiesRes = await fetch(facilitiesUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!facilitiesRes.ok) {
      throw new Error(`Failed to fetch facilities.json: ${facilitiesRes.status}`);
    }

    const facilitiesData = await facilitiesRes.json();
    const facilitiesContent = Buffer.from(facilitiesData.content, 'base64').toString('utf-8');
    const facilities = JSON.parse(facilitiesContent);

    const usedImages = new Set(
      facilities
        .map((f: any) => f.thumbnail)
        .filter((t: string) => t && t.includes('/images/facilities/'))
    );

    console.log('[cleanup-images] Found', usedImages.size, 'used images');

    // Get all files in public/images/facilities/
    const files = await getDirectoryContents(
      token,
      repo,
      'public/images/facilities'
    );

    const imagesToDelete = files.filter((file: any) => {
      const fullPath = `/images/facilities/${file.name}`;
      return !usedImages.has(fullPath);
    });

    console.log('[cleanup-images] Found', imagesToDelete.length, 'unused images to delete');

    if (imagesToDelete.length === 0) {
      console.log('[cleanup-images] No unused images to clean up');
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Delete unused images
    let successCount = 0;
    let failureCount = 0;

    for (const file of imagesToDelete) {
      try {
        await deleteFile(
          token,
          repo,
          `public/images/facilities/${file.name}`,
          file.sha
        );
        console.log('[cleanup-images] Deleted', file.name);
        successCount++;
      } catch (err) {
        console.error(
          '[cleanup-images] Failed to delete',
          file.name,
          ':',
          err
        );
        failureCount++;
      }
    }

    console.log('[cleanup-images] Cleanup complete! Deleted:', successCount, 'Failed:', failureCount);

    return NextResponse.json({
      success: true,
      deletedCount: successCount,
      failureCount: failureCount,
    });
  } catch (error) {
    console.error('[cleanup-images] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
