const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function run() {
  // 1. 環境変数のチェック
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  // 2. SDKの初期化
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // モデル指定（"models/"は不要、バージョン指定もSDKが内部で処理）
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = "縄文遺跡のデータをJSON形式で出力してください。既存の facilities.json に追加可能な形式にしてください。";

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 3. JSON抽出（GeminiがMarkdownの ```json ... ``` を返してきた場合の対策）
    const jsonMatch = text.match(/\[?\{[\s\S]*\}?\]/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON in Gemini response");
    }
    
    const newData = JSON.parse(jsonMatch[0]);

    // 4. ファイルの更新処理
    const filePath = "./facilities.json";
    let existingData = [];
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    // データのマージ（重複排除などのロジックをここに）
    const updatedData = [...existingData, ...newData];

    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
    console.log("Successfully updated facilities.json");

  } catch (error) {
    console.error("Detailed Error:", error.message);
    // 404の場合、ここでモデル名やAPIキーの権限を再チェックするログを出す
    process.exit(1);
  }
}

run();
