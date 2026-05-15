// ================== server.js ==================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Config
import { env, validateEnv } from "./configuration/env.js";
import { RATE_LIMIT_CONFIG } from "./configuration/constants.js";

// Services & Utils
import groqService from "./services/groqService.js";
import cacheManager from "./utils/cache.js";
import Validators from "./utils/validators.js";
import AnalysisHelpers from "./utils/helpers.js";
import ErrorHandler from "./middleware/errorHandler.js";

// OCR functions
import {
  preprocessImage,
  performOCRWithMultipleVersions,
  performSmartOCR,
  ultraFastPreprocess,
} from "./optimized-ocr.js";

// ================== VALIDATE ENV ==================

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ API KEY not found in .env");
  process.exit(1);
}

try {
  validateEnv();
  console.log("✅ Environment variables validated");
} catch (error) {
  console.error("❌ Environment validation failed:", error.message);
  process.exit(1);
}

// ================== APP CONFIG ==================

const app = express();
const PORT = process.env.PORT || 5001;

// ================== MIDDLEWARE ==================

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.windowMs || 15 * 60 * 1000,
  max: RATE_LIMIT_CONFIG.max || 100,
  message: {
    error: "Too many requests, please try again later",
  },
});

app.use(limiter);

// CORS
app.options("*", cors());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://smart-ingredient-analyzer.vercel.app",
            "https://ai-ingredient-analyzer.vercel.app",
            /\.vercel\.app$/,
          ]
        : [
            "http://localhost:5173",
            "http://127.0.0.1:5173"
          ],
    credentials: true,
  })
);

// Body parser
app.use(bodyParser.json({ limit: "10mb" }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ================== ROUTES ==================

// Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Smart Ingredient Analyzer API Running",
    environment: process.env.NODE_ENV || "development",
    port: PORT,
  });
});

// ================== ANALYZE ROUTE ==================

app.post("/api/analyze", async (req, res, next) => {
  try {
    const startTime = Date.now();

    // ================== VALIDATE REQUEST ==================

    const bodyValidation = Validators.validateRequestBody(req);

    if (!bodyValidation.valid) {
      console.error(`❌ ${bodyValidation.error}`);
      return res.status(400).json(bodyValidation);
    }

    const { image, fastMode = true, isMobile = false } = req.body;

    // ================== VALIDATE IMAGE ==================

    const imageValidation = Validators.validateImage(image);

    if (!imageValidation.valid) {
      console.error(`❌ ${imageValidation.error}`);
      return res.status(400).json(imageValidation);
    }

    // ================== BASE64 VALIDATION ==================

    let imageBuffer;

    try {
      const base64Data = image.includes(",")
        ? image.split(",")[1]
        : image;

      const base64Validation =
        Validators.validateBase64(base64Data);

      if (!base64Validation.valid) {
        console.error(`❌ ${base64Validation.error}`);
        return res.status(400).json(base64Validation);
      }

      imageBuffer = Buffer.from(base64Data, "base64");

      const bufferValidation =
        Validators.validateImageBuffer(imageBuffer);

      if (!bufferValidation.valid) {
        console.error(`❌ ${bufferValidation.error}`);

        return res
          .status(bufferValidation.statusCode || 400)
          .json(bufferValidation);
      }
    } catch (bufferError) {
      console.error(
        "❌ Buffer creation error:",
        bufferError.message
      );

      return res.status(400).json({
        error: "Invalid image data format",
        code: "INVALID_IMAGE_DATA",
        details: bufferError.message,
      });
    }

    // ================== IMAGE SIZE CHECK ==================

    console.log(
      `📊 Image size: ${(imageBuffer.length / 1024).toFixed(
        1
      )}KB`
    );

    const maxSizeBytes = 15 * 1024 * 1024;

    if (imageBuffer.length > maxSizeBytes) {
      return res.status(413).json({
        error: "Image file too large",
        code: "IMAGE_TOO_LARGE",
        maxSize: "15MB",
      });
    }

    const minSizeBytes = 1024;

    if (imageBuffer.length < minSizeBytes) {
      return res.status(400).json({
        error: "Image file too small",
        code: "IMAGE_TOO_SMALL",
        minSize: "1KB",
      });
    }

    // ================== OCR PROCESSING ==================

    let bestOcrResult;

    try {
      console.log("🔍 Starting OCR processing...");

      try {
        const processedBuffer =
          await ultraFastPreprocess(
            imageBuffer,
            isMobile
          );

        bestOcrResult =
          await performSmartOCR(processedBuffer);

        console.log("✅ Fast OCR mode successful");
      } catch (fastError) {
        console.log(
          `⚠️ Fast mode failed: ${fastError.message}`
        );

        console.log(
          "🔄 Switching to standard OCR mode..."
        );

        const processedImages =
          await preprocessImage(imageBuffer);

        bestOcrResult =
          await performOCRWithMultipleVersions(
            processedImages
          );

        console.log("✅ Standard OCR mode successful");
      }

      if (!bestOcrResult) {
        return res.status(400).json({
          error: "OCR failed",
          code: "OCR_FAILED",
        });
      }

      if (!bestOcrResult.text) {
        return res.status(400).json({
          error: "No text detected in image",
          code: "NO_TEXT_DETECTED",
        });
      }
    } catch (ocrError) {
      console.error(
        "❌ OCR processing failed:",
        ocrError.message
      );

      return res.status(400).json({
        error:
          ocrError.message || "Unable to process image",
        code: "OCR_PROCESSING_FAILED",
      });
    }

    // ================== INGREDIENT EXTRACTION ==================

    const ingredientsOnly =
      AnalysisHelpers.extractIngredients(
        bestOcrResult.text
      );

    let finalIngredients;

    if (!ingredientsOnly || ingredientsOnly.length < 5) {
      const fallbackIngredients = bestOcrResult.text
        .replace(/nutritional information.*$/i, "")
        .replace(/serving size.*$/i, "")
        .replace(/manufactured.*$/i, "")
        .trim();

      if (
        !fallbackIngredients ||
        fallbackIngredients.length < 10
      ) {
        return res.status(400).json({
          error:
            "No ingredient list found in image.",
          code: "INSUFFICIENT_INGREDIENTS",
          extractedText: ingredientsOnly,
        });
      }

      finalIngredients = fallbackIngredients;
    } else {
      finalIngredients = ingredientsOnly;
    }

    // ================== CACHE ==================

    const cacheKey =
      cacheManager.generateKey(finalIngredients);

    const cachedResult =
      cacheManager.get(cacheKey);

    if (cachedResult) {
      console.log("✅ Returning cached result");

      return res.json({
        ...cachedResult,
        cached: true,
      });
    }

    // ================== GROQ AI ANALYSIS ==================

    console.log("🤖 Starting Groq AI analysis...");

    const aiStartTime = Date.now();

    try {
      const groqResult = await groqService.analyze(
        finalIngredients,
        {
          isMobile,
          fastMode,
        }
      );

      const aiTime = Date.now() - aiStartTime;

      // ================== POST PROCESSING ==================

      const allergens =
        AnalysisHelpers.detectAllergens(
          finalIngredients
        );

      const healthScore =
        AnalysisHelpers.calculateHealthScore(
          groqResult.analysis
        );

      const harmfulDetected =
        AnalysisHelpers.detectHarmfulIngredients(
          groqResult.analysis
        );

      const totalTime = Date.now() - startTime;

      const result = {
        ingredientsText: finalIngredients,
        analysis: groqResult.analysis,
        healthScore,
        allergens,
        harmfulIngredients: harmfulDetected,
        ocrConfidence: bestOcrResult.confidence,
        ocrMethod: bestOcrResult.method,
        processingTime: totalTime,
        fastMode,
        isMobile,
        cached: false,
        aiTime,
      };

      // ================== SAVE CACHE ==================

      cacheManager.set(cacheKey, result);

      console.log(
        `✅ Analysis completed in ${totalTime}ms`
      );

      return res.json(result);
    } catch (groqError) {
      console.error(
        "❌ Groq service error:",
        groqError.message
      );

      return res.status(500).json({
        error: "AI analysis failed",
        code: "GROQ_API_ERROR",
        details: groqError.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

// ================== 404 HANDLER ==================

app.all("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
  });
});

// ================== GLOBAL ERROR HANDLER ==================

app.use((error, req, res, next) => {
  console.error("❌ Global Error:", error);

  if (ErrorHandler?.handle) {
    return ErrorHandler.handle(error, req, res);
  }

  return res.status(500).json({
    error: "Internal Server Error",
    details: error.message,
  });
});

// ================== GRACEFUL SHUTDOWN ==================

process.on("SIGTERM", () => {
  console.log(
    "🛑 SIGTERM received, shutting down gracefully..."
  );

  cacheManager.close?.();

  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(
    "🛑 SIGINT received, shutting down gracefully..."
  );

  cacheManager.close?.();

  process.exit(0);
});

// ================== START SERVER ==================

app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📍 Environment: ${
      process.env.NODE_ENV || "development"
    }`
  );
  console.log("✅ GROQ API KEY Loaded");
  console.log("=================================");
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} already in use`);
    console.log("👉 Change PORT in .env file");
  } else {
    console.error("❌ Server error:", err);
  }
});

export default app;