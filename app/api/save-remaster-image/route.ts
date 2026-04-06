import { NextResponse, NextRequest } from 'next/server';

export const maxDuration = 60; // Vercel timeout

export async function POST(request: NextRequest) {
  try {
    const { pollinationsUrl, facilityId, conceptLabel } = await request.json();

    if (!pollinationsUrl || !facilityId || !conceptLabel) {
      return NextResponse.json(
        { error: 'pollinationsUrl, facilityId, conceptLabel are required' },
        { status: 400 }
      );
    }

    if (!['a', 'b', 'c'].includes(conceptLabel)) {
      return NextResponse.json(
        { error: 'conceptLabel must be a, b, or c' },
        { status: 400 }
      );
    }

    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;

    if (!token || !repo) {
      return NextResponse.json(
        { error: 'GitHub credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch image from Pollinations
    const imgRes = await fetch(pollinationsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
    });

    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image from Pollinations: ${imgRes.status}` },
        { status: 502 }
      );
    }

    const imageBuffer = await imgRes.arrayBuffer();
    const base64Content = Buffer.from(imageBuffer).toString('base64');

    // GitHub API path
    const githubPath = `public/images/facilities/${facilityId}_remaster_${conceptLabel}.png`;
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${githubPath}`;

    // Get existing SHA if file exists
    let existingSha: string | undefined;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (getRes.ok) {
        const fileData = await getRes.json();
        existingSha = fileData.sha;
      }
      // 404 is normal for new files
    } catch {
      // Ignore SHA fetch errors
    }

    // GitHub API PUT to commit
    const putBody: Record<string, string> = {
      message: `chore(images): add deep remaster for facility ${facilityId}`,
      content: base64Content,
      branch: 'main',
    };

    if (existingSha) {
      putBody.sha = existingSha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      return NextResponse.json(
        { error: `GitHub PUT failed: ${putRes.status}`, details: errData },
        { status: 502 }
      );
    }

    const localPath = `/images/facilities/${facilityId}_remaster_${conceptLabel}.png`;
    return NextResponse.json({ success: true, localPath });
  } catch (error) {
    console.error('[save-remaster-image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
