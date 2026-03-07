const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    // 1. SDKの初期化
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 2. モデルの取得（apiVersionを明示的に指定して v1beta への自動ルーティングを防ぐ）
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1" } // ←ここが404回避の生命線です
    );

    const prompt = "日本の縄文遺跡（特にまだ facilities.json にないもの）を1つ探し、以下のJSON形式で出力してください。 [{\"name\": \"遺跡名\", \"location\": \"住所\", \"description\": \"解説\"}] 。必ず純粋なJSONのみを返し、余計な文章は含めないでください。";

    console.log("Fetching data from Gemini API (v1)...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 3. JSON抽出（GeminiがMarkdown記法 ```json ... ``` を使った場合の対策）
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);

    // 4. ファイル読み書き
    const filePath = "facilities.json";
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    const updatedData = [...existingData, ...newData];
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    console.log(`Successfully added ${newData.length} facility. Total: ${updatedData.length}`);

  } catch (error) {
    // エラー内容を詳細に出力して原因を特定しやすくする
    console.error("--- Detailed Error Report ---");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
    }
    console.error("-----------------------------");
    process.exit(1);
  }
}

run();
