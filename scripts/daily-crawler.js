const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 最新モデル 2.5-flash を使用
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash" }, 
      { apiVersion: "v1" }
    );

    // 既存のデータを読み込む
    const filePath = path.join(__dirname, "../facilities.json");
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    // 既存の遺跡名の一覧を作成（重複防止用）
    const existingNames = existingData.map(d => d.name).join(", ");

    const prompt = `
      日本の縄文遺跡を新たに1つ探し、以下のJSON形式で出力してください。
      
      【重要：重複禁止】
      以下の遺跡はすでにリストに存在します。これら「以外」の、まだリストにない遺跡を必ず選んでください：
      ${existingNames}

      出力は必ず以下の配列形式にしてください：
      [ { "name": "...", "location": "...", "description": "..." } ]
      
      ※純粋なJSONデータのみを出力し、余計な解説文は一切含めないでください。
    `;

    console.log("Connecting to Gemini API (v1) using gemini-2.5-flash...");
    console.log(`Checking against ${existingData.length} existing records...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Markdownの装飾を除去してパース
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);

    // 取得したデータが既存のものと被っていないか最終チェック
    const isDuplicate = existingData.some(d => d.name === newData[0].name);

    if (isDuplicate) {
      console.log(`⚠️ Duplicate found: ${newData[0].name}. Skipping save.`);
    } else {
      const updatedData = [...existingData, ...newData];
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
      console.log(`--- Execution Success ---`);
      console.log(`Added New Site: ${newData[0].name}`);
      console.log(`Total records now: ${updatedData.length}`);
    }

  } catch (error) {
    console.error("Detailed Error:", error.message);
    process.exit(1);
  }
}

// ここまで入っているか確認してください
run();
