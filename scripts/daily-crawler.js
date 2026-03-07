const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

    const filePath = path.join(__dirname, "../facilities.json");
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    const existingNames = existingData.map(d => d.name);

    const prompt = `
      日本の縄文遺跡を1つ選び、JSONで出力してください。
      
      【絶対遵守のルール】
      以下の遺跡名はすでにリストに存在します。これらとは「異なる」別の遺跡を必ず選んでください。
      既にある遺跡：${existingNames.join(", ")}

      【出力形式】
      [ { "name": "遺跡名", "location": "所在地", "description": "解説" } ]
      ※JSON以外のテキストは一切含めないでください。
    `;

    console.log(`Checking against ${existingData.length} records...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);
    const newSiteName = newData[0].name;

    // 名前が完全に一致するか、名前に既存の文字列が含まれているかチェック
    const isDuplicate = existingNames.some(name => newSiteName.includes(name) || name.includes(newSiteName));

    if (isDuplicate) {
      console.error(`❌ Duplicate detected: "${newSiteName}" is already in the list.`);
      process.exit(1); // エラーとして終了させ、保存を防ぐ
    } else {
      const updatedData = [...existingData, ...newData];
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
      console.log(`--- Execution Success ---`);
      console.log(`Added New Site: ${newSiteName}`);
      console.log(`Total records: ${updatedData.length}`);
    }

  } catch (error) {
    console.error("Detailed Error:", error.message);
    process.exit(1);
  }
}

run();
