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
  
  if (!text || text.trim().length === 0) {
    console.log("❌ Empty text provided to extractIngredients");
    return "";
  }
  
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
    
  if (lines.length === 0) {
    console.log("❌ No lines found after splitting text");
    return text.trim(); // Return original text if no lines found
  }
    
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
  
  // If no ingredients section found, try to use the entire text
  if (!startFound && ingredientLines.length === 0) {
    console.log("⚠️ No ingredients section found, using entire text");
    // Look for lines that might contain ingredients
    ingredientLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return lowerLine.includes('water') || 
             lowerLine.includes('sugar') || 
             lowerLine.includes('salt') ||
             lowerLine.includes('oil') ||
             lowerLine.includes('spices') ||
             lowerLine.includes('ins') ||
             /\d+\.?\d*%/.test(line) ||
             line.includes(',');
    });
    
    // If still nothing found, use all lines
    if (ingredientLines.length === 0) {
      ingredientLines = lines;
    }
  }
  
  const result = ingredientLines
    .join(" ")
    .replace(/[{}[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s,().%\-:]/g, "")
    // Don't remove all numbers, keep percentages and INS codes
    .replace(/\b(?!ins)\d+(?!\d*%|ins)\b/gi, "")
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

Special notes for Indian food additives:
- INS codes (like INS1422, INS415, etc.) are food additive codes used in India
- Treat these as stabilizers, emulsifiers, or preservatives based on their function
- Jaggery is unrefined sugar, healthier than white sugar but still sugar
- Tamarind is a natural fruit extract, generally good

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
  
  // Enhanced request validation
  if (!req.body) {
    console.error("❌ No request body received");
    return res.status(400).json({ 
      error: "No request body", 
      code: "NO_REQUEST_BODY" 
    });
  }

  const { image, fastMode = true, isMobile = false } = req.body;

  console.log(`📥 Received analysis request: fastMode=${fastMode}, isMobile=${isMobile}`);
  console.log(`📊 Request body keys: ${Object.keys(req.body)}`);
  console.log(`📊 Image data type: ${typeof image}`);
  console.log(`📊 Image data length: ${image ? image.length : 'undefined'}`);

  if (!image) {
    console.error("❌ Image field is missing from request");
    return res
      .status(400)
      .json({ error: "Image is missing", code: "MISSING_IMAGE" });
  }

  // Validate image format
  if (typeof image !== 'string') {
    console.error("❌ Image data is not a string");
    return res.status(400).json({ 
      error: "Image must be a base64 string", 
      code: "INVALID_IMAGE_FORMAT" 
    });
  }

  try {
    console.log(`🚀 Starting analysis (fastMode: ${fastMode}, isMobile: ${isMobile})`);

    // Enhanced image buffer creation with better error handling
    let imageBuffer;
    try {
      // Handle both data URL format and plain base64
      const base64Data = image.includes(',') ? image.split(",")[1] : image;
      
      if (!base64Data) {
        throw new Error("No base64 data found in image");
      }
      
      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        throw new Error("Invalid base64 format");
      }
      
      imageBuffer = Buffer.from(base64Data, "base64");
      
      if (imageBuffer.length === 0) {
        throw new Error("Empty image buffer");
      }
      
    } catch (bufferError) {
      console.error("❌ Buffer creation error:", bufferError.message);
      return res.status(400).json({ 
        error: "Invalid image data format", 
        code: "INVALID_IMAGE_DATA",
        details: bufferError.message
      });
    }
    
    // Log image size for debugging
    console.log(`📊 Image size: ${(imageBuffer.length / 1024).toFixed(1)}KB, buffer length: ${imageBuffer.length}`);

    // Validate image size limits
    const maxSizeBytes = 15 * 1024 * 1024; // 15MB for higher quality images
    if (imageBuffer.length > maxSizeBytes) {
      console.error(`❌ Image too large: ${imageBuffer.length} bytes`);
      return res.status(413).json({ 
        error: "Image file too large", 
        code: "IMAGE_TOO_LARGE",
        maxSize: "15MB"
      });
    }

    const minSizeBytes = 1024; // 1KB minimum
    if (imageBuffer.length < minSizeBytes) {
      console.error(`❌ Image too small: ${imageBuffer.length} bytes`);
      return res.status(400).json({ 
        error: "Image file too small", 
        code: "IMAGE_TOO_SMALL",
        minSize: "1KB"
      });
    }

    let bestOcrResult;

    // Enhanced mobile optimization
    try {
      console.log("🔄 Starting OCR processing...");
      const processedBuffer = await ultraFastPreprocess(imageBuffer, isMobile);
      console.log("✅ Image preprocessing completed");
      bestOcrResult = await performSmartOCR(processedBuffer);
      console.log("✅ Smart OCR completed");
    } catch (fastError) {
      console.log(`⚠️ Fast mode failed: ${fastError.message}, trying standard mode`);
      // Fallback to standard mode
      try {
        const processedImages = await preprocessImage(imageBuffer);
        bestOcrResult = await performOCRWithMultipleVersions(processedImages);
      } catch (fallbackError) {
        console.error("❌ Both OCR methods failed:", fallbackError.message);
        return res.status(400).json({
          error: "Unable to process image. Please ensure it contains clear text.",
          code: "OCR_PROCESSING_FAILED",
          details: fallbackError.message
        });
      }
    }

    if (!bestOcrResult) {
      console.error("❌ OCR returned no results");
      return res.status(400).json({ error: "OCR failed", code: "OCR_FAILED" });
    }

    if (!bestOcrResult.text) {
      console.error("❌ OCR returned empty text");
      return res.status(400).json({ 
        error: "No text detected in image", 
        code: "NO_TEXT_DETECTED" 
      });
    }

    console.log(
      `🔍 OCR completed: ${bestOcrResult.method}, confidence: ${bestOcrResult.confidence}%, processing: ${bestOcrResult.processingTime || 0}ms`
    );

    const ingredientsOnly = extractIngredients(bestOcrResult.text);
    console.log(`📝 Extracted ingredients: "${ingredientsOnly}"`);
    
    if (!ingredientsOnly || ingredientsOnly.length < 5) {
      console.log(`❌ Insufficient ingredients: length=${ingredientsOnly?.length || 0}`);
      console.log(`📝 Original OCR text: "${bestOcrResult.text}"`);
      
      // Try a more lenient extraction for edge cases
      const fallbackIngredients = bestOcrResult.text
        .replace(/nutritional information.*$/i, '')
        .replace(/serving size.*$/i, '')
        .replace(/manufactured.*$/i, '')
        .trim();
        
      if (fallbackIngredients && fallbackIngredients.length >= 10) {
        console.log(`🔄 Using fallback extraction: "${fallbackIngredients}"`);
        const ingredientsOnly = fallbackIngredients;
      } else {
        return res.status(400).json({
          error: "No ingredient list found in image. Please focus on the ingredients section of the food label.",
          code: "INSUFFICIENT_INGREDIENTS",
          extractedText: ingredientsOnly,
          debug: {
            originalText: bestOcrResult.text,
            extractedLength: ingredientsOnly?.length || 0,
            ocrMethod: bestOcrResult.method,
            ocrConfidence: bestOcrResult.confidence
          }
        });
      }
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
    
    if (!geminiResponse.ok) {
      console.error("❌ Gemini API HTTP error:", geminiResponse.status, geminiResponse.statusText);
      return res.status(500).json({ 
        error: "AI analysis service error", 
        code: "GEMINI_HTTP_ERROR",
        status: geminiResponse.status
      });
    }
    
    if (geminiJson.error) {
      console.error("Gemini API error:", geminiJson.error);
      return res
        .status(500)
        .json({ 
          error: "AI analysis failed", 
          code: "GEMINI_API_ERROR",
          details: geminiJson.error.message || "Unknown Gemini error"
        });
    }

    let geminiText =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
    if (!geminiText) {
      console.error("❌ Empty response from Gemini API");
      return res.status(500).json({ 
        error: "AI analysis returned empty response", 
        code: "EMPTY_AI_RESPONSE" 
      });
    }
    
    geminiText = geminiText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    console.log(`📝 Cleaned Gemini response: "${geminiText.substring(0, 200)}..."`);

    let analysis;
    try {
      analysis = JSON.parse(geminiText);
      
      if (!Array.isArray(analysis)) {
        throw new Error("Response is not an array");
      }
      
      if (analysis.length === 0) {
        throw new Error("Empty analysis array");
      }
      
      console.log(`✅ Parsed analysis: ${analysis.length} ingredients`);
    } catch (e) {
      console.error("Parse error:", e.message, "Raw text:", geminiText);
      return res
        .status(500)
        .json({ 
          error: "Failed to parse AI analysis", 
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
