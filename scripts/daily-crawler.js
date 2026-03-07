const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

    // ファイルの絶対パスを確実に指定
    const filePath = path.resolve(__dirname, "../facilities.json");
    
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    // 【重要】もし読み込めた件数が少ない場合、AIに「有名どころ」を避けるよう強く指示
    const existingNames = existingData.map(d => d.name);
    
    const regions = ["関東", "中部", "近畿", "中国", "四国", "九州"]; // 重複しがちな北東北をあえて外す
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];

    const prompt = `
      日本の縄文遺跡を1つ選び、JSON形式で出力してください。
      
      【最優先：重複禁止ルール】
      以下の遺跡は「絶対に」選ばないでください。既にリストにあります：
      三内丸山遺跡, 大湯環状列石, 御所野遺跡, 是川石器時代遺跡, 小牧野遺跡
      その他、既にリストにある ${existingData.length} 件の遺跡。

      【今回の条件】
      ターゲット地方: 【${randomRegion}地方】
      世界遺産ではない、その土地ならではの遺跡を探してください。

      [ { "name": "遺跡名", "location": "都道府県・市区町村", "description": "解説" } ]
    `;

    console.log(`Current recognized records: ${existingData.length}. Region: ${randomRegion}`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const newData = JSON.parse(jsonString);
    const newSiteName = newData[0].name;

    // 部分一致も含めた厳格チェック
    const isDuplicate = existingNames.some(name => newSiteName.includes(name) || name.includes(newSiteName));

    if (isDuplicate) {
      console.error(`❌ Duplicate detected: "${newSiteName}".`);
      process.exit(1); 
    }

    const updatedData = [...existingData, ...newData];
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    console.log(`--- Success ---`);
    console.log(`Added: ${newSiteName}`);
    console.log(`Total count: ${updatedData.length}`);

  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
