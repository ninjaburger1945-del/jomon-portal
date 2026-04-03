export async function POST(request) {
  try {
    const { startId, endId } = await request.json();

    if (!startId || !endId) {
      return Response.json(
        { error: 'Missing startId or endId' },
        { status: 400 }
      );
    }

    // Validate IDs
    const start = parseInt(startId);
    const end = parseInt(endId);

    if (isNaN(start) || isNaN(end) || start < 1 || end > 999 || start > end) {
      return Response.json(
        { error: 'Invalid ID range. Start and End must be between 1-999 and Start ≤ End.' },
        { status: 400 }
      );
    }

    // Trigger GitHub Actions workflow
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return Response.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      'https://api.github.com/repos/ninjaburger1945-del/jomon-portal/actions/workflows/regenerate-images.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            start_id: String(start),
            end_id: String(end)
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json(
        { error: `Failed to trigger workflow: ${error}` },
        { status: response.status }
      );
    }

    return Response.json({
      success: true,
      message: `GitHub Actions で ID ${start}-${end} の画像再生成を開始しました。`,
      workflowUrl: 'https://github.com/ninjaburger1945-del/jomon-portal/actions'
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
