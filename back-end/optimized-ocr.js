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

  // Must have minimum score to be considered valid
  const minScore = 15;
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
    const base64Image = imageBuffer.toString("base64");
    
    console.log(`🔍 Gemini Vision: Processing ${(base64Image.length / 1024).toFixed(1)}KB image`);

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
                  text: "Extract ONLY the ingredients list from this food label image. Focus on the section that starts with 'Ingredients:' or 'Contains:'. Return the raw ingredient text without formatting. If no ingredients are visible, respond with 'NO_INGREDIENTS_FOUND'.",
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
    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || "Gemini Vision API error");
    }

    const extractedText =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!extractedText.trim()) {
      throw new Error("No text extracted from image");
    }

    // Check if Gemini detected it's not a food label
    if (extractedText.trim() === "NO_INGREDIENTS_FOUND" || extractedText.trim() === "NOT_FOOD_LABEL") {
      throw new Error(
        "Image does not appear to contain ingredient information"
      );
    }

    // Validate the extracted text
    const validation = validateIngredientText(extractedText);

    if (!validation.isValid) {
      throw new Error(`Invalid ingredient image: ${validation.reason}`);
    }

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
export async function ultraFastPreprocess(imageBuffer) {
  try {
    // Get image info first
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`📊 Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Determine optimal size based on original dimensions
    const maxWidth = metadata.width > 2000 ? 1200 : Math.min(metadata.width, 1000);
    
    const processed = await sharp(imageBuffer)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .normalize({
        lower: 1,
        upper: 99
      })
      .modulate({ 
        brightness: 1.05, 
        contrast: 1.15,
        saturation: 0.9
      })
      .sharpen({
        sigma: 1,
        flat: 1,
        jagged: 2
      })
      .jpeg({ 
        quality: 85, 
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
        error.message.includes("does not appear to contain ingredient")
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
