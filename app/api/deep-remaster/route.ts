import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const JOMON_OS_SUFFIX_V2 =
  'Authentic Jomon period Japan, 16:9 wide aspect ratio, cinematic lighting, gritty prehistoric textures. NO LATER HISTORICAL ELEMENTS (No Yayoi, No Kofun, No Yayoi wet-rice, No bronze, No iron, No tunic-style clothing).';

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

    const systemPrompt = `You are an archaeological specialist for Jomon period Japan ONLY.

CRITICAL FILTERING RULE:
If input contains multiple historical periods (Yayoi, Kofun, Edo, etc), EXTRACT AND USE JOMON ELEMENTS ONLY.

STRICTLY FORBIDDEN elements (these indicate non-Jomon periods):
- Elevated storehouses (Yayoi+)
- Metal objects (bronze, iron, mirrors, swords)
- Keyhole-shaped mounds (Kofun)
- Wet-rice paddies
- Tunic-style clothing (Yayoi+)
- Fortified structures or castles

MANDATORY JOMON elements:
- Sunken-floor pithouses (Tateana-jukyo): circular or rectangular pits dug into earth
- Thatched roofs made of Kaya grass (Miscanthus sinensis)
- Cord-marked pottery (Jomon-doki) with intricate patterns
- Stone tools (Sekki)
- Clay figurines (Dogu)
- Shell middens (Kaizuka)
- Dense broadleaf forest landscape
- Flickering hearth fires

OUTPUT FORMAT:
{"concept_a":"...", "concept_b":"...", "concept_c":"..."}

CONCEPT DEFINITIONS (3-axis temporal separation):

concept_a - THE ANCIENT LIVING (太古の動):
Ancient Jomon daily life, approximately 10,000 years ago. Sunken-floor pithouses with smoke rising. Multiple dwellings with people engaged in hunting, gathering, cooking around hearths. Raw, gritty, alive with human activity. Dawn or dusk dramatic lighting. Cord-marked pottery and stone tools visible. Dense primitive forest surrounds the settlement. MUST include active human presence and signs of daily life.
Start with: "${JOMON_OS_SUFFIX_V2}"

concept_b - THE MODERN RUIN (現代の静):
A contemporary archaeological site or park. Static, quiet atmosphere. Reconstructed pithouses standing silently in a forested archaeological park. Moss-covered mounds, eroded earth structures. Museum-like presentation. NO human activity. NO people. Focus on the 'modern viewer's perspective' looking at Jomon remains. Archaeological landscape with signage, preserved earth layers. Silent, contemplative mood.
Keywords: Archaeological park, modern-day ruin, moss-covered remains, silent atmosphere, museum-like landscape, preservation.
Start with: "${JOMON_OS_SUFFIX_V2}"

concept_c - THE ARTIFACT CLOSE-UP (象徴的遺物):
Museum-display lighting and presentation. Macro-level detail. Focus on a representative cord-marked pottery vessel and/or Dogu figurine. Dramatic spotlighting. Show intricate cord-marked textures, clay surface patina, ancient soil stains. Dogu mysterious expression. Cinematic museum photography with dark background gradient. Emphasize the mystical, spiritual essence of Jomon artifacts.
Start with: "${JOMON_OS_SUFFIX_V2}"

EACH PROMPT:
- 100-150 words English
- Realistic documentary style (NO fantasy/anime)
- MUST open with Jomon OS v2 suffix
- NO contamination from later periods`;

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
      if (concepts[key] && !concepts[key].includes('Authentic Jomon')) {
        concepts[key] = `${concepts[key]}\n${JOMON_OS_SUFFIX_V2}`;
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
