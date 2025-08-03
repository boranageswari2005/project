import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import NodeCache from "node-cache";
import crypto from "crypto";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const cache = new NodeCache({ stdTTL: 86400 });

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env");
  process.exit(1);
} else {
  console.log("✅ Gemini API Key loaded");
}

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many requests, please try again later" },
});
app.use(limiter);

app.options("*", cors());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://smart-ingredient-analyzer.vercel.app"]
        : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const harmfulIngredients = new Set([
  "trans fat",
  "partially hydrogenated oil",
  "high fructose corn syrup",
  "aspartame",
  "sodium nitrate",
  "sodium nitrite",
  "bha",
  "bht",
  "artificial colors",
  "red dye 40",
  "yellow 5",
  "yellow 6",
  "monosodium glutamate",
  "msg",
  "carrageenan",
  "sodium benzoate",
]);

const allergens = {
  gluten: ["wheat", "barley", "rye", "malt", "triticale"],
  dairy: ["milk", "lactose", "casein", "whey", "butter", "cream"],
  nuts: ["peanut", "almond", "walnut", "cashew", "pecan", "hazelnut"],
  soy: ["soy", "soybean", "lecithin"],
  eggs: ["egg", "albumin", "mayonnaise"],
  shellfish: ["shrimp", "crab", "lobster", "mollusk"],
};

function generateCacheKey(ingredients) {
  return crypto
    .createHash("md5")
    .update(ingredients.toLowerCase())
    .digest("hex");
}

function detectAllergens(ingredients) {
  const detectedAllergens = [];
  const ingredientsLower = ingredients.toLowerCase();
  for (const [allergen, keywords] of Object.entries(allergens)) {
    if (keywords.some((keyword) => ingredientsLower.includes(keyword))) {
      detectedAllergens.push(allergen);
    }
  }
  return detectedAllergens;
}

function calculateHealthScore(analysis) {
  let score = 100;
  let goodCount = 0;
  let badCount = 0;
  let neutralCount = 0;
  analysis.forEach((item) => {
    switch (item.status.toLowerCase()) {
      case "good":
        goodCount++;
        break;
      case "bad":
        badCount++;
        score -= 15;
        break;
      case "neutral":
        neutralCount++;
        score -= 5;
        break;
    }
  });
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { good: goodCount, bad: badCount, neutral: neutralCount },
  };
}

function extractIngredients(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let ingredientLines = [],
    startFound = false;
  for (let line of lines) {
    if (!startFound && /ingredients?|contents?|contains?/i.test(line)) {
      startFound = true;
      const cleanLine = line.replace(/^ingredients?:?\s*/i, "");
      if (cleanLine) ingredientLines.push(cleanLine);
      continue;
    }
    if (startFound) {
      if (
        /^(nutritional|nutrition|storage|manufactured|marketed|packed|usage|instructions|allergy|net weight|best before|expiry)/i.test(
          line
        )
      )
        break;
      ingredientLines.push(line);
    }
  }
  return ingredientLines
    .join(" ")
    .replace(/[{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s,().%\-]/g, "")
    .replace(/\b[0-9]+\b/g, "")
    .replace(/\b[a-zA-Z]{1}\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function createGeminiPrompt(ingredients) {
  return `You are a certified nutritionist and food safety expert. Analyze these food ingredients and provide a comprehensive health assessment.
IMPORTANT: Return ONLY a valid JSON array. No markdown, explanations, or extra text.
For each ingredient, determine:
- Health impact (Good/Bad/Neutral)
- Brief scientific reason
- Specific health concerns if any
Ingredients to analyze:
${ingredients}
Expected JSON format:
[
  {
    "ingredient": "sugar",
    "status": "Bad",
    "reason": "High glycemic index, linked to obesity and diabetes",
    "concerns": ["diabetes", "obesity", "dental health"]
  }
]`.trim();
}

import {
  preprocessImage,
  performOCRWithMultipleVersions,
} from "./optimized-ocr.js";

app.post("/api/analyze", async (req, res) => {
  const startTime = Date.now();
  const { image } = req.body;
  if (!image)
    return res
      .status(400)
      .json({ error: "Image is missing", code: "MISSING_IMAGE" });
  try {
    const imageBuffer = Buffer.from(image.split(",")[1] || image, "base64");
    const processedImages = await preprocessImage(imageBuffer);
    const bestOcrResult = await performOCRWithMultipleVersions(processedImages);
    if (!bestOcrResult)
      return res.status(400).json({ error: "OCR failed", code: "OCR_FAILED" });
    const ingredientsOnly = extractIngredients(bestOcrResult.text);
    if (!ingredientsOnly || ingredientsOnly.length < 5)
      return res.status(400).json({
        error: "Insufficient ingredients",
        code: "INSUFFICIENT_INGREDIENTS",
      });
    const cacheKey = generateCacheKey(ingredientsOnly);
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) return res.json({ ...cachedResult, cached: true });
    const prompt = createGeminiPrompt(ingredientsOnly);
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    );
    const geminiJson = await geminiResponse.json();
    if (geminiJson.error)
      return res
        .status(500)
        .json({ error: "Gemini API error", code: "GEMINI_API_ERROR" });
    let geminiText =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    geminiText = geminiText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    let analysis;
    try {
      analysis = JSON.parse(geminiText);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Parse error", code: "PARSE_ERROR" });
    }
    const allergenInfo = detectAllergens(ingredientsOnly);
    const healthScore = calculateHealthScore(analysis);
    const harmfulDetected = analysis.filter((item) =>
      harmfulIngredients.has(item.ingredient.toLowerCase())
    );
    const result = {
      ingredientsText: ingredientsOnly,
      analysis,
      healthScore,
      allergens: allergenInfo,
      harmfulIngredients: harmfulDetected,
      ocrConfidence: bestOcrResult.confidence,
      ocrMethod: `${bestOcrResult.imageName}-${bestOcrResult.configName}`,
      processingTime: Date.now() - startTime,
      cached: false,
    };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal error", code: "INTERNAL_ERROR" });
  }
});

app.all("*", (req, res) =>
  res.status(404).json({ error: "Endpoint not found" })
);

process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  cache.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Food Analyzer API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
