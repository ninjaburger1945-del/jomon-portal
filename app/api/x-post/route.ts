import { NextResponse, NextRequest } from 'next/server';

/**
 * X (Twitter) POST API Stub
 *
 * Future implementation will use X API v2 with Bearer Token:
 * Authorization: Bearer <JOMON_X_API_BEARER_TOKEN>
 * POST https://api.twitter.com/2/tweets
 */
export async function POST(request: NextRequest) {
  try {
    const { facilityName, facilityId, message } = await request.json();

    if (!facilityName || !facilityId) {
      return NextResponse.json(
        { error: 'facilityName and facilityId are required' },
        { status: 400 }
      );
    }

    console.log('[API] X Post request:', { facilityName, facilityId, message });

    // Stub implementation: always return posted: false
    // TODO: Implement real X API v2 integration when credentials are configured
    const xBearerToken = process.env.JOMON_X_API_BEARER_TOKEN;

    if (!xBearerToken) {
      return NextResponse.json({
        success: true,
        posted: false,
        reason: 'X API credentials not configured'
      });
    }

    // Future: Implement real X API v2 call here
    // const tweetText = message || `${facilityName}を紹介しています | JOMON PORTAL #縄文`;
    // const xResponse = await fetch('https://api.twitter.com/2/tweets', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${xBearerToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     text: tweetText,
    //   }),
    // });

    return NextResponse.json({
      success: true,
      posted: false,
      reason: 'X API credentials not configured'
    });
  } catch (error) {
    console.error('[API] X Post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
