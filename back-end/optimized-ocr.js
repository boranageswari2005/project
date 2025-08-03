// optimized-ocr.js - FAST VERSION
import Tesseract from "tesseract.js";
import sharp from "sharp";

// Lightweight preprocessing - only 2 versions instead of 4
export async function preprocessImage(imageBuffer) {
  const processedImages = [];

  try {
    // Single optimized preprocessing that works well for most ingredient labels
    const optimized = await sharp(imageBuffer)
      .resize(2000, null, {
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3, // Faster than default
      })
      .normalize()
      .modulate({ brightness: 1.1, contrast: 1.3, saturation: 0.8 })
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
      .jpeg({ quality: 92, progressive: false }) // Progressive false is faster
      .toBuffer();

    // Fallback grayscale version only if needed
    const grayscale = await sharp(imageBuffer)
      .resize(1800, null, { withoutEnlargement: true })
      .grayscale()
      .normalize()
      .modulate({ brightness: 1.15, contrast: 1.4 })
      .sharpen({ sigma: 1.2 })
      .jpeg({ quality: 90, progressive: false })
      .toBuffer();

    processedImages.push(
      { name: "optimized", buffer: optimized, priority: 1 },
      { name: "grayscale", buffer: grayscale, priority: 2 }
    );
  } catch (error) {
    console.error("[Preprocessing Error]", error);
    // Fallback to original
    processedImages.push({
      name: "original",
      buffer: imageBuffer,
      priority: 3,
    });
  }

  return processedImages;
}

// Fast OCR with early termination and smart config selection
export async function performOCRWithMultipleVersions(processedImages) {
  // Sort by priority (best preprocessing first)
  processedImages.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  // Optimized configs - start with most likely to succeed
  const ocrConfigs = [
    {
      name: "ingredient_optimized",
      options: {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,().-% :",
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: "1",
      },
    },
    {
      name: "auto_fallback",
      options: {
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: "1",
      },
    },
  ];

  let bestResult = null;

  // Try with best preprocessing first
  for (const image of processedImages) {
    for (const config of ocrConfigs) {
      try {
        const startTime = Date.now();

        const result = await Tesseract.recognize(image.buffer, "eng", {
          logger: () => {}, // Disable logging for speed
          ...config.options,
        });

        const processingTime = Date.now() - startTime;
        console.log(
          `OCR ${image.name}-${config.name}: ${processingTime}ms, confidence: ${result.data.confidence}`
        );

        const ocrResult = {
          imageName: image.name,
          configName: config.name,
          text: result.data.text,
          confidence: result.data.confidence,
          words: result.data.words?.length || 0,
          processingTime,
        };

        // Update best result
        if (!bestResult || ocrResult.confidence > bestResult.confidence) {
          bestResult = ocrResult;
        }

        // Early termination conditions - return immediately if good enough
        if (ocrResult.confidence > 80 && ocrResult.words > 8) {
          console.log(
            `Early termination: Good result found (${ocrResult.confidence}% confidence)`
          );
          return ocrResult;
        }

        // If we get decent result with first image, don't try other images
        if (ocrResult.confidence > 65 && image.priority === 1) {
          console.log(
            `Skipping other preprocessing versions - decent result found`
          );
          break; // Break out of config loop, but continue with this image
        }
      } catch (error) {
        console.error(
          `[OCR Failure]: ${image.name}-${config.name}`,
          error.message
        );
      }
    }

    // If we found a good result with priority 1 image, don't try others
    if (bestResult && bestResult.confidence > 65 && image.priority === 1) {
      break;
    }
  }

  return bestResult;
}

// Alternative: Single-shot fast OCR for when speed is critical
export async function performFastOCR(imageBuffer) {
  try {
    // Minimal preprocessing
    const processed = await sharp(imageBuffer)
      .resize(1600, null, { withoutEnlargement: true })
      .normalize()
      .modulate({ brightness: 1.1, contrast: 1.2 })
      .jpeg({ quality: 85, progressive: false })
      .toBuffer();

    const result = await Tesseract.recognize(processed, "eng", {
      logger: () => {},
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,().-% :",
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
    });

    return {
      imageName: "fast_processed",
      configName: "single_shot",
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words?.length || 0,
    };
  } catch (error) {
    console.error("[Fast OCR Error]", error);
    throw error;
  }
}
