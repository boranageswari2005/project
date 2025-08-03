import React from "react";

import ProcessingStatus from "./ProcessingStatus";

// START: ImagePreview Component
const ImagePreview = ({
  imageSrc,
  onAnalyze,
  onReset,
  processingState,
  analysisReady,
}) => {
  const { isProcessing, status, progress, ocrText } = processingState;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <img
          src={imageSrc}
          alt="Preview"
          className="rounded-lg shadow-md w-full max-w-md"
        />
        {analysisReady && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
            ✓ Ready!
          </div>
        )}
      </div>

      {isProcessing && (
        <ProcessingStatus
          status={status}
          progress={progress}
          ocrText={ocrText}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          onClick={onAnalyze}
          disabled={isProcessing && !analysisReady}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all transform ${
            analysisReady
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:scale-105 animate-pulse"
              : isProcessing
              ? "bg-gray-400 text-gray-200 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white shadow-md hover:scale-105"
          } cursor-pointer`}
        >
          {isProcessing && !analysisReady
            ? "Processing..."
            : analysisReady
            ? "🚀 View Results (Ready!)"
            : "🧪 Analyze Ingredients"}
        </button>

        <button
          onClick={onReset}
          className="text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
        >
          🔁 Retake
        </button>
      </div>
    </div>
  );
};
// END: ImagePreview Component

export default ImagePreview;
