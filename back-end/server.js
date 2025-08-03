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

// Longer cache TTL for better performance
const cache = new NodeCache({ stdTTL: 172800 }); // 48 hours

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env");
  process.exit(1);
} else {
  console.log("✅ Gemini API Key loaded");
}

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased limit
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

// Simplified harmful ingredients set for faster lookup
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

// Optimized allergen detection
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
  let goodCount = 0,
    badCount = 0,
    neutralCount = 0;

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

// Optimized ingredient extraction
function extractIngredients(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let ingredientLines = [];
  let startFound = false;

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
      ) {
        break;
      }
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

// Optimized Gemini prompt
function createGeminiPrompt(ingredients) {
  return `Analyze these ingredients as a nutritionist. Return ONLY valid JSON array:
${ingredients}

Format:
[{"ingredient":"name","status":"Good/Bad/Neutral","reason":"brief reason","concerns":["concern1"]}]`;
}

import {
  preprocessImage,
  performOCRWithMultipleVersions,
  performFastOCR,
} from "./optimized-ocr.js";

// Add a fast mode endpoint
app.post("/api/analyze", async (req, res) => {
  const startTime = Date.now();
  const { image, fastMode = false } = req.body;

  if (!image) {
    return res
      .status(400)
      .json({ error: "Image is missing", code: "MISSING_IMAGE" });
  }

  try {
    const imageBuffer = Buffer.from(image.split(",")[1] || image, "base64");

    let ocrResult;

    if (fastMode) {
      // Fast mode: Single OCR attempt
      console.log("🚀 Using fast mode");
      ocrResult = await performFastOCR(imageBuffer);
    } else {
      // Standard mode: Multiple attempts with early termination
      const processedImages = await preprocessImage(imageBuffer);
      ocrResult = await performOCRWithMultipleVersions(processedImages);
    }

    if (!ocrResult) {
      return res.status(400).json({ error: "OCR failed", code: "OCR_FAILED" });
    }

    const ingredientsOnly = extractIngredients(ocrResult.text);

    if (!ingredientsOnly || ingredientsOnly.length < 5) {
      return res.status(400).json({
        error: "Insufficient ingredients detected",
        code: "INSUFFICIENT_INGREDIENTS",
        extractedText: ingredientsOnly,
      });
    }

    // Check cache first
    const cacheKey = generateCacheKey(ingredientsOnly);
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      console.log(`✅ Cache hit - ${Date.now() - startTime}ms`);
      return res.json({ ...cachedResult, cached: true });
    }

    // Gemini API call with timeout
    const prompt = createGeminiPrompt(ingredientsOnly);
    const geminiStartTime = Date.now();

    const geminiResponse = await Promise.race([
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024, // Reduced for faster response
            },
          }),
        }
      ),
      new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("Gemini API timeout")), 10000) // 10s timeout
      ),
    ]);

    const geminiTime = Date.now() - geminiStartTime;
    console.log(`🤖 Gemini API: ${geminiTime}ms`);

    const geminiJson = await geminiResponse.json();

    if (geminiJson.error) {
      return res.status(500).json({
        error: "Gemini API error",
        code: "GEMINI_API_ERROR",
        details: geminiJson.error.message,
      });
    }

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
      console.error("Parse error:", geminiText.substring(0, 200));
      return res.status(500).json({
        error: "Failed to parse AI response",
        code: "PARSE_ERROR",
      });
    }

    // Quick processing of additional data
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
      ocrConfidence: ocrResult.confidence,
      ocrMethod: `${ocrResult.imageName}-${ocrResult.configName}`,
      processingTime: Date.now() - startTime,
      cached: false,
      performance: {
        ocrTime: ocrResult.processingTime || 0,
        geminiTime,
        totalTime: Date.now() - startTime,
      },
    };

    // Cache the result
    cache.set(cacheKey, result);

    console.log(`✅ Total processing: ${result.processingTime}ms`);
    res.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      processingTime: Date.now() - startTime,
    });
  }
});

// Health endpoint with cache stats
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
    },
  });
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
