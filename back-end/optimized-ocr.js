// optimized-ocr.js - SAFE COMPATIBLE VERSION
import sharp from "sharp";
import fetch from "node-fetch";

// OPTION 1: Gemini Vision OCR (Uses your existing API key)
export async function performGeminiVisionOCR(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Extract all text from this image, especially ingredient lists. Return only the raw text without any formatting or explanations.",
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || "Gemini Vision API error");
    }

    const extractedText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (extractedText.trim()) {
      return {
        text: extractedText.trim(),
        confidence: 85,
        method: "gemini_vision",
        words: extractedText.trim().split(/\s+/).length,
      };
    }

    throw new Error("No text extracted");
  } catch (error) {
    console.error("[Gemini Vision OCR Error]", error.message);
    throw error;
  }
}

// Ultra-fast preprocessing
export async function ultraFastPreprocess(imageBuffer) {
  try {
    const processed = await sharp(imageBuffer)
      .resize(1200, null, {
        withoutEnlargement: true,
        kernel: sharp.kernel.nearest,
      })
      .normalize()
      .modulate({ brightness: 1.1, contrast: 1.2 })
      .jpeg({ quality: 80, progressive: false })
      .toBuffer();

    return processed;
  } catch (error) {
    console.error("[Ultra Fast Preprocessing Error]", error);
    return imageBuffer; // Return original if preprocessing fails
  }
}

// Fallback to your existing Tesseract if Gemini fails
import Tesseract from "tesseract.js";

export async function performFallbackOCR(imageBuffer) {
  try {
    console.log("🔄 Using fallback Tesseract OCR...");

    const result = await Tesseract.recognize(imageBuffer, "eng", {
      logger: () => {},
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,().-% :",
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      method: "tesseract_fallback",
      words: result.data.words?.length || 0,
    };
  } catch (error) {
    console.error("[Fallback OCR Error]", error);
    throw error;
  }
}

// Smart OCR that tries Gemini first, falls back to Tesseract
export async function performSmartOCR(imageBuffer) {
  // First try Gemini Vision (fast)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🚀 Trying Gemini Vision OCR...");
      const startTime = Date.now();

      const result = await performGeminiVisionOCR(imageBuffer);
      const processingTime = Date.now() - startTime;

      console.log(
        `✅ Gemini Vision: ${processingTime}ms, confidence: ${result.confidence}%`
      );

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      console.log(`❌ Gemini Vision failed: ${error.message}`);
      console.log("🔄 Falling back to Tesseract...");
    }
  }

  // Fallback to Tesseract
  try {
    const startTime = Date.now();
    const result = await performFallbackOCR(imageBuffer);
    const processingTime = Date.now() - startTime;

    console.log(
      `⚠️ Tesseract fallback: ${processingTime}ms, confidence: ${result.confidence}%`
    );

    return {
      ...result,
      processingTime,
    };
  } catch (error) {
    console.error("All OCR methods failed:", error);
    throw new Error("OCR processing failed");
  }
}

// Keep your existing functions for backward compatibility
export async function preprocessImage(imageBuffer) {
  const processedImages = [];

  try {
    const optimized = await ultraFastPreprocess(imageBuffer);
    processedImages.push({ name: "optimized", buffer: optimized, priority: 1 });
  } catch (error) {
    console.error("[Preprocessing Error]", error);
    processedImages.push({
      name: "original",
      buffer: imageBuffer,
      priority: 3,
    });
  }

  return processedImages;
}

export async function performOCRWithMultipleVersions(processedImages) {
  const imageBuffer = processedImages[0]?.buffer || processedImages[0];
  return await performSmartOCR(imageBuffer);
}
