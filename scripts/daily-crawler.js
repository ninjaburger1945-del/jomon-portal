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
    // apiVersion: "v1" を指定することで 404 エラーを確実に回避します
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
    // 余計な文字（Markdownの枠など）を削
