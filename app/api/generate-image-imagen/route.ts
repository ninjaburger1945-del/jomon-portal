import { NextResponse, NextRequest } from 'next/server';

/**
 * Imagen 4.0 で画像生成
 * ディープリマスター用の高品質画像生成エンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

    const requestBody = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/png'
      }
    };

    console.log('[generate-image-imagen] Imagen リクエスト中...', prompt.substring(0, 100));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[generate-image-imagen] API エラー:', response.status, responseText.substring(0, 500));
      return NextResponse.json(
        { error: `Imagen API error: ${response.status}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[generate-image-imagen] JSON パースエラー:', e);
      return NextResponse.json(
        { error: 'Invalid response from Imagen API' },
        { status: 500 }
      );
    }

    if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
      const imageBase64 = data.predictions[0].bytesBase64Encoded;
      const dataUrl = `data:image/png;base64,${imageBase64}`;

      console.log('[generate-image-imagen] 生成成功');

      return NextResponse.json({
        success: true,
        dataUrl: dataUrl,
        imageSize: imageBase64.length
      });
    } else {
      console.error('[generate-image-imagen] 予期しない応答形式:', data);
      return NextResponse.json(
        { error: 'Unexpected response format from Imagen API' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[generate-image-imagen] エラー:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
