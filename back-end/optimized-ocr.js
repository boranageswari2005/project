// optimized-ocr.js
import Tesseract from "tesseract.js";
import sharp from "sharp";

// Advanced preprocessing to improve OCR accuracy
export async function preprocessImage(imageBuffer) {
  const processedImages = [];
  try {
    const standard = await sharp(imageBuffer)
      .resize(2500, null, { withoutEnlargement: true })
      .normalize()
      .modulate({ brightness: 1.1, contrast: 1.2, saturation: 0.8 })
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0, x1: 2, y2: 10 })
      .toColorspace("srgb")
      .jpeg({ quality: 95 })
      .toBuffer();

    const highContrast = await sharp(imageBuffer)
      .resize(2200, null, { withoutEnlargement: true })
      .normalize()
      .modulate({ brightness: 1.15, contrast: 1.4, saturation: 0.6 })
      .gamma(1.2)
      .sharpen({ sigma: 1.5, m1: 1.0, m2: 3.0, x1: 3, y2: 15 })
      .linear(1.2, -(128 * 1.2) + 128)
      .jpeg({ quality: 92 })
      .toBuffer();

    const grayscale = await sharp(imageBuffer)
      .resize(2000, null, { withoutEnlargement: true })
      .grayscale()
      .normalize()
      .modulate({ brightness: 1.2, contrast: 1.5 })
      .sharpen({ sigma: 2.0, m1: 1.5, m2: 4.0, x1: 4, y2: 20 })
      .threshold(128, { grayscale: false })
      .blur(0.3)
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();

    const denoised = await sharp(imageBuffer)
      .resize(2300, null, { withoutEnlargement: true })
      .median(2)
      .normalize()
      .modulate({ brightness: 1.05, contrast: 1.3, saturation: 0.7 })
      .sharpen({ sigma: 1.2, m1: 0.8, m2: 2.5 })
      .jpeg({ quality: 93 })
      .toBuffer();

    processedImages.push(
      { name: "standard", buffer: standard },
      { name: "high_contrast", buffer: highContrast },
      { name: "grayscale", buffer: grayscale },
      { name: "denoised", buffer: denoised }
    );
  } catch (error) {
    console.error("[Preprocessing Error]", error);
    processedImages.push({ name: "original", buffer: imageBuffer });
  }
  return processedImages;
}

// Tries OCR with different configurations and returns the best result
export async function performOCRWithMultipleVersions(processedImages) {
  const ocrConfigs = [
    {
      name: "precise",
      options: {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,().-% :",
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      },
    },
    {
      name: "sparse",
      options: {
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,().-% :",
      },
    },
    {
      name: "auto",
      options: {
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: "1",
      },
    },
  ];

  const ocrResults = [];

  for (const image of processedImages) {
    for (const config of ocrConfigs) {
      try {
        const result = await Tesseract.recognize(image.buffer, "eng", {
          logger: () => {},
          ...config.options,
        });

        const ocrResult = {
          imageName: image.name,
          configName: config.name,
          text: result.data.text,
          confidence: result.data.confidence,
          words: result.data.words?.length || 0,
        };

        ocrResults.push(ocrResult);

        if (ocrResult.confidence > 85 && ocrResult.words > 10) {
          return ocrResult;
        }
      } catch (error) {
        console.error(`[OCR Failure]: ${image.name}-${config.name}`, error);
      }
    }
  }

  return ocrResults.reduce((best, current) => {
    const currentScore = current.confidence * 0.7 + current.words * 0.3;
    const bestScore = best.confidence * 0.7 + best.words * 0.3;
    return currentScore > bestScore ? current : best;
  }, ocrResults[0]);
}
