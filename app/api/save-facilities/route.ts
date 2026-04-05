import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

async function saveWithRetry(
  token: string,
  repo: string,
  facilities: any[],
  maxRetries: number = 3,
  retryCount: number = 0
): Promise<any> {
  try {
    // 1. Get current SHA
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/app/data/facilities.json`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getRes.ok) {
      throw new Error(`Failed to get current file: ${getRes.status}`);
    }

    const fileData = await getRes.json();

    // 2. PUT updated content
    const newContent = JSON.stringify(facilities, null, 2);
    const encodedContent = Buffer.from(newContent).toString('base64');

    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/app/data/facilities.json`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'chore(admin): update facilities via admin dashboard',
          content: encodedContent,
          sha: fileData.sha,
          branch: 'main',
        }),
      }
    );

    if (!putRes.ok) {
      const errData = await putRes.json();
      // 409 Conflict: retry with latest SHA
      if (errData.status === 409 && retryCount < maxRetries) {
        console.log(`[API] SHA conflict, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
        return saveWithRetry(token, repo, facilities, maxRetries, retryCount + 1);
      }
      throw new Error(`Failed to save: ${putRes.status} - ${JSON.stringify(errData)}`);
    }

    return await putRes.json();
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { facilities } = await request.json();

    // 【要確認】ラベルが削除された施設に userApproved フラグを設定
    // これにより、クローラーが再実行時に【要確認】を復活させない
    const facilitiesWithApprovalFlags = facilities.map((facility: any) => {
      if (!facility.name?.includes('【要確認】')) {
        // 【要確認】がない = ユーザーが承認・削除した
        return { ...facility, userApproved: true };
      }
      return facility;
    });

    console.log('[API] Approval flags set for facilities without 【要確認】');

    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;

    if (!token || !repo) {
      return NextResponse.json(
        { error: 'GitHub credentials not configured' },
        { status: 400 }
      );
    }

    console.log('[API] Saving facilities to GitHub:', repo);
    console.log('[API] Token configured:', !!token);

    await saveWithRetry(token, repo, facilitiesWithApprovalFlags);

    console.log('[API] Successfully saved to GitHub!');

    // ISR: Revalidate all affected paths after successful save
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/facilities', 'page');
      revalidatePath('/facility/[id]', 'page');
      console.log('[API] ISR cache invalidated for all paths');
    } catch (revalidateErr) {
      console.warn('[API] ISR revalidation partial failure (non-blocking):', revalidateErr);
      // Continue - this is not a blocker for the save operation
    }

    return NextResponse.json({ success: true, revalidated: true });
  } catch (error) {
    console.error('[API] Save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
