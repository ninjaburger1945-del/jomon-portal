const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    // 1. 最新モデル gemini-2.0-flash を使用（1.5は404になるため）
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.0-flash" }, // リストにあった最新モデルを指定
      { apiVersion: "v1" }
    );

    const prompt = `
      日本の縄文遺跡を1つ探し、以下のJSON形式で出力してください。
      出力は必ず [ { "name": "...", "location": "...", "description": "..." } ] のような配列形式にしてください。
      純粋なJSONデータのみを出力し、解説は含めないでください。
    `;

    console.log("Connecting to Gemini API (v1) using gemini-2.0-flash...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);

    // 2. ファイルパスの解決（scripts直下ではなくルートのファイルを指定）
    const filePath = path.join(__dirname, "../facilities.json");
    
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    const updatedData = [...existingData, ...newData];
    
    // 3. ファイルを保存（存在しない場合は新規作成される）
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    console.log(`--- Execution Success ---`);
    console.log(`Added: ${newData[0]?.name}`);
    console.log(`Total records: ${updatedData.length}`);

  } catch (error) {
    console.error("Detailed Error:", error.message);
    process.exit(1);
  }
}

run();
