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

    // Generate GitHub Actions URL
    const workflowUrl = `https://github.com/ninjaburger1945-del/jomon-portal/actions/workflows/regenerate-images.yml`;

    return Response.json({
      success: true,
      message: `ID ${start}-${end} の画像再生成をリクエストしました`,
      startId: start,
      endId: end,
      workflowUrl: workflowUrl,
      instructionUrl: `${workflowUrl}?check_suite_focus=true`
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
