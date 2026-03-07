const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    // 1. 環境変数の確認
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    // 2. SDKの初期化とモデルの取得
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1" }
    );

    // 3. プロンプトの設定
    const prompt = `
      日本の縄文遺跡を1つ探し、以下のJSON形式で出力してください。
      出力は必ず [ { "name": "...", "location": "...", "description": "..." } ] のような配列形式にしてください。
      純粋なJSONデータのみを出力し、前後に解説やMarkdownの装飾（\`\`\`jsonなど）を含めないでください。
    `;

    console.log("Connecting to Gemini API (v1)...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. JSONの抽出とパース
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    let newData;
    try {
      newData = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse JSON. Raw response:", text);
      throw new Error("Gemini returned invalid JSON format.");
    }

    // 5. ファイルの読み書き（パスの解決）
    const filePath = path.join(__dirname, "../facilities.json");
    
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      try {
        existingData = JSON.parse(fileContent || "[]");
      } catch (e) {
        console.warn("Existing facilities.json was invalid. Starting fresh.");
        existingData = [];
      }
    }

    // 6. データのマージと保存
    const updatedData = [...existingData, ...newData];
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    console.log("--- Execution Success ---");
    console.log(`Added: ${newData[0]?.name || "Unknown site"}`);
    console.log(`Total records: ${updatedData.length}`);
    console.log("-------------------------");

  } catch (error) {
    console.error("--- Detailed Error Report ---");
    console.error("Message:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    console.error("-----------------------------");
    process.exit(1);
  }
}

// 最後にこの関数を呼び出す
run();
