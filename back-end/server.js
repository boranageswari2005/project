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

// Extended cache for better performance
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
  max: 100,
  message: { error: "Too many requests, please try again later" },
});
app.use(limiter);

app.options("*", cors());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://smart-ingredient-analyzer.vercel.app",
            "https://ai-ingredient-analyzer.vercel.app",
            /\.vercel\.app$/,
            /\.netlify\.app$/
          ]
        : ["http://localhost:3000", "http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
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
  console.log(`🔍 Extracting ingredients from: "${text.substring(0, 100)}..."`);
  
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
    
  let ingredientLines = [],
    startFound = false;
    
  for (let line of lines) {
    if (!startFound && /ingredients?|contents?|contains?/i.test(line)) {
      startFound = true;
      console.log(`📍 Found ingredients start: "${line}"`);
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
        console.log(`🛑 Found end marker: "${line}"`);
        break;
      }
      ingredientLines.push(line);
    }
  }
  
  const result = ingredientLines
    .join(" ")
    .replace(/[{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s,().%\-]/g, "")
    .replace(/\b[0-9]+\b/g, "")
    .replace(/\b[a-zA-Z]{1}\b/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .trim();
    
  console.log(`✅ Final extracted ingredients: "${result}"`);
  return result;
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

// Import the optimized OCR functions
import {
  preprocessImage,
  performOCRWithMultipleVersions,
  performSmartOCR,
  ultraFastPreprocess,
} from "./optimized-ocr.js";

app.post("/api/analyze", async (req, res) => {
  const startTime = Date.now();
  const { image, fastMode = true, isMobile = false } = req.body;

  console.log(`📥 Received analysis request: fastMode=${fastMode}, isMobile=${isMobile}`);

  if (!image) {
    return res
      .status(400)
      .json({ error: "Image is missing", code: "MISSING_IMAGE" });
  }

  try {
    console.log(`🚀 Starting analysis (fastMode: ${fastMode}, isMobile: ${isMobile})`);

    const imageBuffer = Buffer.from(image.split(",")[1] || image, "base64");
    
    // Log image size for debugging
    console.log(`📊 Image size: ${(imageBuffer.length / 1024).toFixed(1)}KB, buffer length: ${imageBuffer.length}`);

    // Validate image buffer
    if (imageBuffer.length === 0) {
      return res.status(400).json({ 
        error: "Invalid image data", 
        code: "INVALID_IMAGE_DATA" 
      });
    }

    let bestOcrResult;

    // Enhanced mobile optimization
    try {
      const processedBuffer = await ultraFastPreprocess(imageBuffer, isMobile);
      bestOcrResult = await performSmartOCR(processedBuffer);
    } catch (fastError) {
      console.log(`⚠️ Fast mode failed: ${fastError.message}, trying standard mode`);
      // Fallback to standard mode
      const processedImages = await preprocessImage(imageBuffer);
      bestOcrResult = await performOCRWithMultipleVersions(processedImages);
    }

    if (!bestOcrResult) {
      return res.status(400).json({ error: "OCR failed", code: "OCR_FAILED" });
    }

    console.log(
      `🔍 OCR completed: ${bestOcrResult.method}, confidence: ${bestOcrResult.confidence}%, processing: ${bestOcrResult.processingTime || 0}ms`
    );

    const ingredientsOnly = extractIngredients(bestOcrResult.text);
    console.log(`📝 Extracted ingredients: "${ingredientsOnly}"`);
    
    if (!ingredientsOnly || ingredientsOnly.length < 5) {
      console.log(`❌ Insufficient ingredients: length=${ingredientsOnly?.length || 0}`);
      return res.status(400).json({
        error: "Insufficient ingredients",
        code: "INSUFFICIENT_INGREDIENTS",
        extractedText: ingredientsOnly,
        debug: {
          originalText: bestOcrResult.text,
          extractedLength: ingredientsOnly?.length || 0
        }
      });
    }

    const cacheKey = generateCacheKey(ingredientsOnly);
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log(`💾 Cache hit: ${Date.now() - startTime}ms`);
      return res.json({ ...cachedResult, cached: true });
    }

    // Gemini analysis with timeout
    const prompt = createGeminiPrompt(ingredientsOnly);
    const geminiStartTime = Date.now();

    // Adaptive timeout based on device
    const timeoutMs = isMobile ? 12000 : fastMode ? 15000 : 20000;

    const geminiResponse = await Promise.race([
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.1, 
              maxOutputTokens: isMobile ? 600 : fastMode ? 800 : 1024,
              candidateCount: 1
            },
          }),
        }
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), timeoutMs)
      ),
    ]);

    const geminiTime = Date.now() - geminiStartTime;
    console.log(`🤖 Gemini analysis: ${geminiTime}ms`);

    const geminiJson = await geminiResponse.json();
    console.log(`🤖 Gemini response status: ${geminiResponse.status}`);
    
    if (geminiJson.error) {
      console.error("Gemini API error:", geminiJson.error);
      return res
        .status(500)
        .json({ 
          error: "Gemini API error", 
          code: "GEMINI_API_ERROR",
          details: geminiJson.error.message || "Unknown Gemini error"
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
      console.log(`✅ Parsed analysis: ${analysis.length} ingredients`);
    } catch (e) {
      console.error("Parse error:", e.message, "Raw text:", geminiText);
      return res
        .status(500)
        .json({ 
          error: "Parse error", 
          code: "PARSE_ERROR",
          details: e.message,
          rawResponse: geminiText.substring(0, 200)
        });
    }

    const allergenInfo = detectAllergens(ingredientsOnly);
    const healthScore = calculateHealthScore(analysis);
    const harmfulDetected = analysis.filter((item) =>
      harmfulIngredients.has(item.ingredient.toLowerCase())
    );

    const totalTime = Date.now() - startTime;

    const result = {
      ingredientsText: ingredientsOnly,
      analysis,
      healthScore,
      allergens: allergenInfo,
      harmfulIngredients: harmfulDetected,
      ocrConfidence: bestOcrResult.confidence,
      ocrMethod: bestOcrResult.method,
      processingTime: totalTime,
      fastMode,
      isMobile,
      cached: false,
    };

    cache.set(cacheKey, result);

    console.log(`✅ Total processing: ${totalTime}ms`);
    res.json(result);
  } catch (error) {
    console.error("Analysis error:", error.message);
    console.error("Full error:", error);
    
    // More specific error messages for mobile users
    let errorMessage = "Internal error";
    let errorCode = "INTERNAL_ERROR";
    
    if (error.message.includes("timeout")) {
      errorMessage = "Analysis timed out. Please try with a clearer image.";
      errorCode = "TIMEOUT_ERROR";
    } else if (error.message.includes("Invalid ingredient image")) {
      errorMessage = "Please upload a clear image of food ingredient labels";
      errorCode = "INVALID_IMAGE";
    } else if (error.message.includes("quota exceeded")) {
      errorMessage = "API quota exceeded. Please try again later.";
      errorCode = "QUOTA_EXCEEDED";
    } else if (error.message.includes("rate limit")) {
      errorMessage = "Too many requests. Please wait a moment.";
      errorCode = "RATE_LIMITED";
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Network error. Please check your connection.";
      errorCode = "NETWORK_ERROR";
    }
    
    res.status(500).json({
      error: errorMessage,
      code: errorCode,
      processingTime: Date.now() - startTime,
      debug: process.env.NODE_ENV === "development" ? error.message : undefined
    });
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
