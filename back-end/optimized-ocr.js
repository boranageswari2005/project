// optimized-ocr.js - WITH INGREDIENT VALIDATION
import sharp from "sharp";
import fetch from "node-fetch";

// Ingredient validation keywords and patterns
const INGREDIENT_KEYWORDS = [
  // Common ingredient words
  "ingredients",
  "contains",
  "flour",
  "sugar",
  "salt",
  "oil",
  "water",
  "milk",
  "egg",
  "wheat",
  "corn",
  "rice",
  "soy",
  "nuts",
  "peanut",
  "dairy",
  "protein",
  "fat",
  "sodium",
  "vitamin",
  "mineral",
  "preservative",
  "artificial",
  "natural",
  "flavor",
  "coloring",
  "extract",
  "powder",
  "syrup",
  "starch",
  "glucose",
  "fructose",
  "citric acid",
  "baking",
  "yeast",
  "gelatin",
  "lecithin",

  // Units and measurements
  "mg",
  "g",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "cup",
  "tbsp",
  "tsp",
  "%",
  "milligram",
  "gram",
  "kilogram",
  "milliliter",
  "liter",
  "ounce",
  "pound",

  // Nutritional terms
  "calories",
  "carbs",
  "carbohydrate",
  "fiber",
  "cholesterol",
  "trans fat",
  "saturated",
  "unsaturated",
  "monounsaturated",
  "polyunsaturated",

  // Allergen warnings
  "allergen",
  "allergy",
  "warning",
  "may contain",
  "processed in facility",
  "gluten",
  "shellfish",
  "fish",
  "sesame",
  "sulfite",

  // Food categories
  "organic",
  "non-gmo",
  "kosher",
  "halal",
  "vegan",
  "vegetarian",
  "free range",
  "pasteurized",
  "homogenized",
];

const NUTRITION_PATTERNS = [
  /\d+\s*(mg|g|kg|ml|l|oz|lb|%)/i,
  /calories\s*:?\s*\d+/i,
  /protein\s*:?\s*\d+/i,
  /fat\s*:?\s*\d+/i,
  /sodium\s*:?\s*\d+/i,
  /sugar\s*:?\s*\d+/i,
  /fiber\s*:?\s*\d+/i,
  /vitamin\s+[a-z]\s*:?\s*\d+/i,
  /\d+\s*calories/i,
];

// Validate if extracted text contains ingredient information
function validateIngredientText(text) {
  if (!text || text.trim().length < 10) {
    return {
      isValid: false,
      reason: "Text too short to be ingredient list",
      confidence: 0,
      score: 0,
    };
  }

  const lowerText = text.toLowerCase();
  let score = 0;
  let foundKeywords = [];
  let foundPatterns = [];

  // Check for ingredient keywords
  INGREDIENT_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += keyword === "ingredients" ? 10 : 2; // "ingredients" gets higher score
      foundKeywords.push(keyword);
    }
  });

  // Check for nutrition patterns
  NUTRITION_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(text)) {
      score += 5;
      foundPatterns.push(`pattern_${index}`);
    }
  });

  // Check for comma-separated lists (common in ingredient lists)
  const commaCount = (text.match(/,/g) || []).length;
  if (commaCount >= 3) {
    score += Math.min(commaCount, 10);
  }

  // Check for parentheses (common in ingredient lists for specifications)
  const parenCount = (text.match(/\(/g) || []).length;
  if (parenCount >= 2) {
    score += Math.min(parenCount * 2, 8);
  }

  // Penalty for very short words (might be noise)
  const words = text.split(/\s+/);
  const shortWords = words.filter((word) => word.length <= 2).length;
  if (shortWords > words.length * 0.5) {
    score -= 10;
  }

  // Even lower minimum score for better acceptance
  const minScore = 5;
  const isValid = score >= minScore;

  return {
    isValid,
    confidence: Math.min(Math.max(score, 0), 100),
    reason: isValid
      ? `Found ${foundKeywords.length} ingredient keywords and ${foundPatterns.length} nutrition patterns`
      : `Score too low (${score}/${minScore}). May not be an ingredient label.`,
    foundKeywords: foundKeywords.slice(0, 5), // Limit for response size
    foundPatterns: foundPatterns.length,
    wordCount: words.length,
    score,
  };
}

// OPTION 1: Gemini Vision OCR with validation
export async function performGeminiVisionOCR(imageBuffer) {
  try {
    const startTime = Date.now();
    
    // Validate input
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Invalid image buffer provided");
    }
    
    const base64Image = imageBuffer.toString("base64");
    
    if (!base64Image) {
      throw new Error("Failed to convert image to base64");
    }
    
    console.log(`🔍 Gemini Vision: Processing ${(base64Image.length / 1024).toFixed(1)}KB image`);

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

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
                  text: "You are an expert at reading food labels. Extract ONLY the ingredients list from this food label image. Look for sections that start with 'Ingredients:', 'Contains:', or similar. Return the complete ingredient text exactly as written, including commas and parentheses. If you cannot find any ingredients list, respond with exactly 'NO_INGREDIENTS_FOUND'. Do not include nutritional information, allergen warnings, or other text.",
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
            maxOutputTokens: 512,
            candidateCount: 1,
          },
        }),
      }
    );

    const processingTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API HTTP error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API HTTP error: ${response.status}`);
    }
    
    const result = await response.json();

    if (result.error) {
      console.error("❌ Gemini API error:", result.error);
      throw new Error(result.error.message || `Gemini Vision API error: ${result.error.code || 'unknown'}`);
    }

    const extractedText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!extractedText.trim()) {
      throw new Error("No text extracted from image");
    }

    // Check if Gemini detected it's not a food label
    const cleanText = extractedText.trim().toUpperCase();
    if (cleanText === "NO_INGREDIENTS_FOUND" || cleanText === "NOT_FOOD_LABEL" || cleanText.includes("NO INGREDIENTS")) {
      throw new Error(
        "Image does not appear to contain ingredient information"
      );
    }

    // Validate the extracted text
    const validation = validateIngredientText(extractedText);

    if (!validation.isValid) {
      console.log(`⚠️ Validation failed: ${validation.reason}, score: ${validation.score}`);
      throw new Error(`Invalid ingredient image: ${validation.reason}`);
    }

    console.log(`✅ Gemini Vision OCR successful: ${extractedText.length} characters extracted`);

    return {
      text: extractedText.trim(),
      confidence: Math.min(validation.confidence, 90),
      method: "gemini_vision",
      words: extractedText.trim().split(/\s+/).length,
      processingTime,
      validation,
    };
  } catch (error) {
    console.error("[Gemini Vision OCR Error]", error.message);
    throw error;
  }
}

// Ultra-fast preprocessing
export async function ultraFastPreprocess(imageBuffer, isMobile = false) {
  try {
    // Get image info first
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`📊 Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Enhanced mobile optimization
    const maxWidth = isMobile 
      ? Math.min(metadata.width, 1000)  // Smaller for mobile
      : metadata.width > 2000 ? 1200 : Math.min(metadata.width, 1200);
    
    const quality = isMobile ? 80 : 85; // Lower quality for mobile to reduce processing time
    
    const processed = await sharp(imageBuffer)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        kernel: isMobile ? sharp.kernel.cubic : sharp.kernel.lanczos3,
      })
      .normalize({
        lower: 1,
        upper: 99
      })
      .modulate({ 
        brightness: isMobile ? 1.1 : 1.05, 
        contrast: isMobile ? 1.2 : 1.15,
        saturation: 0.9
      })
      .sharpen({
        sigma: isMobile ? 0.8 : 1,
        flat: 1,
        jagged: 2
      })
      .jpeg({ 
        quality, 
        progressive: false,
        mozjpeg: true
      })
      .toBuffer();

    console.log(`✅ Processed: ${(processed.length / 1024).toFixed(1)}KB (${((1 - processed.length / imageBuffer.length) * 100).toFixed(1)}% reduction)`);
    return processed;
  } catch (error) {
    console.error("[Ultra Fast Preprocessing Error]", error);
    return imageBuffer;
  }
}

// Fallback to Tesseract with validation
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

    const extractedText = result.data.text;

    // Validate the extracted text
    const validation = validateIngredientText(extractedText);

    if (!validation.isValid) {
      throw new Error(`Invalid ingredient image: ${validation.reason}`);
    }

    return {
      text: extractedText,
      confidence: Math.min(result.data.confidence, validation.confidence),
      method: "tesseract_fallback",
      words: result.data.words?.length || 0,
      validation,
    };
  } catch (error) {
    console.error("[Fallback OCR Error]", error);
    throw error;
  }
}

// Smart OCR with validation
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

      // If it's a validation error, don't fallback - throw it up
      if (
        error.message.includes("Invalid ingredient image") ||
        error.message.includes("does not appear to contain ingredient") ||
        error.message.includes("quota exceeded") ||
        error.message.includes("rate limit")
      ) {
        throw error;
      }

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
    // If it's a validation error, provide user-friendly message
    if (error.message.includes("Invalid ingredient image")) {
      throw new Error(
        "Please upload an image of a food product label with ingredient information"
      );
    }

    console.error("All OCR methods failed:", error);
    throw new Error(
      "Unable to process image. Please ensure the image contains clear ingredient information."
    );
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
