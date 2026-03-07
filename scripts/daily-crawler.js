const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  console.log("--- Starting Model Investigation (Updated) ---");
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    // 最新のSDKでは直接 listModels を呼び出すか、
    // APIのインスタンスからアクセスします
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // APIを直接叩くためのURLを構築してテスト
    // SDKの内部関数ではなく、利用可能なモデルを取得する処理
    console.log("Fetching available models...");
    
    // v1 エンドポイントから利用可能なモデルを取得
    // ※SDKが古い/挙動が不安定な場合を考え、手動でfetchに近い挙動を確認
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`${data.error.code}: ${data.error.message}`);
    }

    console.log("✅ Connection Successful!");
    console.log("--- List of models available for your key ---");
    
    if (data.models) {
      data.models.forEach((m) => {
        console.log(`- ${m.name}`);
      });
    } else {
      console.log("No models found in the response.");
    }
    console.log("---------------------------------------------");

  } catch (error) {
    console.error("❌ Investigation Failed.");
    console.error("Message:", error.message);
    process.exit(1);
  }
}

run();
