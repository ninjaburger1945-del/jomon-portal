import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout

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

    return new Response(
      new ReadableStream({
        async start(controller) {
          const sendLog = (message) => {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ log: message })}\n\n`)
            );
          };

          try {
            sendLog(`[START] 画像再生成を開始します (ID ${start}-${end})`);

            const scriptPath = path.join(process.cwd(), 'scripts', 'regenerate-images.js');
            const geminiApiKey = process.env.GEMINI_API_KEY20261336;

            if (!geminiApiKey) {
              sendLog('[ERROR] ❌ GEMINI_API_KEY20261336 が設定されていません');
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ status: 'error', message: 'API key not configured' })}\n\n`
                )
              );
              controller.close();
              return;
            }

            const process = spawn('node', [scriptPath, String(start), String(end)], {
              cwd: process.cwd(),
              env: {
                ...process.env,
                GEMINI_API_KEY20261336: geminiApiKey,
                NODE_ENV: 'production'
              }
            });

            let outputBuffer = '';

            process.stdout.on('data', (data) => {
              const chunk = data.toString();
              outputBuffer += chunk;

              // Send each complete line as a log event
              const lines = outputBuffer.split('\n');
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                if (line) {
                  sendLog(line);
                }
              }
              outputBuffer = lines[lines.length - 1];
            });

            process.stderr.on('data', (data) => {
              const line = data.toString().trim();
              if (line) {
                sendLog(`[STDERR] ${line}`);
              }
            });

            process.on('close', (code) => {
              if (outputBuffer.trim()) {
                sendLog(outputBuffer);
              }

              if (code === 0) {
                sendLog('[SUCCESS] ✅ 画像再生成が完了しました');
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ status: 'complete', message: 'Regeneration completed successfully' })}\n\n`
                  )
                );
              } else {
                sendLog(`[ERROR] ❌ スクリプトが終了コード ${code} で失敗しました`);
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ status: 'error', message: `Script exited with code ${code}` })}\n\n`
                  )
                );
              }
              controller.close();
            });

            process.on('error', (err) => {
              sendLog(`[ERROR] ❌ プロセスエラー: ${err.message}`);
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`
                )
              );
              controller.close();
            });
          } catch (err) {
            sendLog(`[ERROR] ❌ ${err.message}`);
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`
              )
            );
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
