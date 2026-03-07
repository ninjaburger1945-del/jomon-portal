const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // クォータ制限に強い 'gemini-2.0-flash-lite' を使用
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.0-flash-lite" }, 
      { apiVersion: "v1" }
    );

    const prompt = `
      日本の縄文遺跡を1つ探し、以下のJSON形式で出力してください。
      出力は必ず [ { "name": "...", "location": "...", "description": "..." } ] のような配列形式にしてください。
      純粋なJSONデータのみを出力し、解説は含めないでください。
    `;

    console.log("Connecting to Gemini API (v1) using gemini-2.0-flash-lite...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);

    const filePath = path.join(__dirname, "../facilities.json");
    
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    const updatedData = [...existingData, ...newData];
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    console.log(`--- Execution Success ---`);
    console.log(`Added: ${newData[0]?.name}`);
    console.log(`Total records: ${updatedData.length}`);

  } catch (error) {
    console.error("Detailed Error:", error.message);
    // 429エラー（制限）が出た場合の対策アドバイス
    if (error.message.includes("429")) {
      console.error("💡 クォータ制限に達しました。Google AI StudioでPay-as-you-goを有効にするか、リセットを待ってください。");
    }
    process.exit(1);
  }
}

run();
