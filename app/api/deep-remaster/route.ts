import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const JOMON_OS_SUFFIX =
  'Authentic Jomon period Japan: sunken-floor pithouses (Tateana-jukyo), thatched roofs (Kaya grass), cord-marked pottery (Jomon-doki), clay Dogu, gritty textures, hearth fire, cinematic lighting, documentary style, earth colors, 16:9 aspect ratio. Strictly Jomon period Japan only.';

export async function POST(request: NextRequest) {
  try {
    const { facilityId, url, description, name, prefecture } = await request.json();

    if (!facilityId || !description) {
      return NextResponse.json(
        { error: 'facilityId and description are required' },
        { status: 400 }
      );
    }

    // Scrape URL with 10 second timeout
    let scrapedText = '';
    if (url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const fetchRes = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
        });
        clearTimeout(timeoutId);
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const $ = cheerio.load(html);
          $('script, style, nav, footer, header').remove();
          scrapedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);
        }
      } catch (scrapeErr) {
        console.warn('[deep-remaster] Scraping failed (non-blocking):', scrapeErr);
      }
    }

    // Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Helper function for Gemini API calls with retry logic for 503 errors
    const callGeminiWithRetry = async (
      model: any,
      content: any,
      maxRetries: number = 3
    ): Promise<any> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await model.generateContent(content);
        } catch (err: any) {
          const status = err?.status || err?.message;
          const is503 = status === 503 || err?.message?.includes('Service Unavailable');

          if (is503 && attempt < maxRetries - 1) {
            // Wait with exponential backoff: 2s, 4s, 8s
            const waitTime = 2000 * Math.pow(2, attempt);
            console.log(`[deep-remaster] 503 error, retrying in ${waitTime}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
          throw err;
        }
      }
    };

    const systemPrompt = `You are a Jomon period Japan specialist. Create 3 image prompts in JSON format.

MANDATORY: Each prompt MUST start with this Jomon OS Suffix:
"${JOMON_OS_SUFFIX}"

CONSTRAINTS:
- Output ONLY JSON: {"concept_a":"...", "concept_b":"...", "concept_c":"..."}
- Each prompt: 100-150 words in English
- Realistic documentary style, NO fantasy/anime
- NO Western prehistoric aesthetics - ONLY Japanese Jomon

REQUIRED ELEMENTS:
- Sunken-floor pithouse (Tateana-jukyo) with thatched Kaya grass roof
- Cord-marked pottery (Jomon-doki) in all concepts
- Clay Dogu figurine for concept_c only
- Authentic Jomon period Japan visuals only

CONCEPT SPECS:
concept_a: Settlement with multiple pithouses, hearths, human activity, dramatic dawn/dusk light
concept_b: Archaeological landscape integrating pithouses with site-specific features (shell mound, lake, obsidian, etc)
concept_c: Close-up macro photography of pottery patterns, Dogu figurine detail, museum lighting`;

    const userContent = `Facility: ${name}, ${prefecture}
Description: ${description}
${scrapedText ? `\nSite Info: ${scrapedText}` : ''}

Create 3 image generation prompts for Pollinations AI based on this Jomon site.`;

    let result;
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      result = await callGeminiWithRetry(model, [
        { text: systemPrompt },
        { text: userContent },
      ]);
    } catch (modelErr: any) {
      // Check for 429 Quota Exceeded
      if (modelErr?.status === 429 || modelErr?.message?.includes('Quota')) {
        return NextResponse.json(
          {
            error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
            code: 'QUOTA_EXCEEDED',
          },
          { status: 429 }
        );
      }
      // Fallback to gemini-2.5-flash-lite on model not found
      if (modelErr?.message?.includes('not found') || modelErr?.status === 404) {
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
          result = await callGeminiWithRetry(fallbackModel, [
            { text: systemPrompt },
            { text: userContent },
          ]);
        } catch (fallbackErr: any) {
          if (fallbackErr?.status === 429 || fallbackErr?.message?.includes('Quota')) {
            return NextResponse.json(
              {
                error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
                code: 'QUOTA_EXCEEDED',
              },
              { status: 429 }
            );
          }
          throw fallbackErr;
        }
      } else {
        throw modelErr;
      }
    }

    const responseText = result.response.text().trim();

    // Extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Gemini returned invalid format', raw: responseText.slice(0, 500) },
        { status: 500 }
      );
    }

    const concepts = JSON.parse(jsonMatch[0]);

    // Ensure Jomon OS suffix is present
    for (const key of ['concept_a', 'concept_b', 'concept_c'] as const) {
      if (concepts[key] && !concepts[key].includes('Archaeological reconstruction')) {
        concepts[key] = `${concepts[key]}, ${JOMON_OS_SUFFIX}`;
      }
    }

    return NextResponse.json(concepts);
  } catch (error) {
    console.error('[deep-remaster] Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const is503 = errorMsg.includes('Service Unavailable') || errorMsg.includes('503');
    const is429 = errorMsg.includes('Quota') || errorMsg.includes('429');

    if (is429) {
      return NextResponse.json(
        {
          error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: is503
          ? 'Gemini API が高い負荷を受けています。申し訳ありません。30秒待機してから再度🎨ボタンをクリックしてください。'
          : errorMsg,
      },
      { status: is503 ? 503 : 500 }
    );
  }
}
