const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // モデル一覧を取得するAPIを直接叩く
    const result = await genAI.listModels();
    
    console.log("--- 利用可能なモデル一覧 ---");
    result.models.forEach((m) => {
      console.log(`Model Name: ${m.name}`);
      console.log(`Supported Methods: ${m.supportedGenerationMethods.join(", ")}`);
      console.log("----------------------------");
    });
  } catch (error) {
    console.error("モデル一覧の取得に失敗しました:", error.message);
  }
}
check();
