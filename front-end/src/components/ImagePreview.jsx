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
    <div className="flex flex-col items-center gap-4 px-4 sm:px-0">
      <div className="relative w-full max-w-md">
        <img
          src={imageSrc}
          alt="Preview"
          className="rounded-xl shadow-lg w-full h-auto object-cover"
        />
        {analysisReady && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-lg">
            ✓ Ready!
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black bg-opacity-30 rounded-xl flex items-center justify-center">
            <div className="bg-white rounded-lg p-3 shadow-lg">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
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
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:scale-105 animate-pulse active:scale-95"
              : isProcessing
              ? "bg-gray-400 text-gray-200 cursor-not-allowed opacity-75"
              : "bg-green-600 hover:bg-green-700 text-white shadow-md hover:scale-105 active:scale-95"
          } cursor-pointer`}
        >
          {isProcessing && !analysisReady
            ? "Processing..."
            : analysisReady
            ? "🚀 View Results"
            : "🧪 Analyze Ingredients"}
        </button>

        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 border-2 border-red-300 text-red-600 px-4 py-3 sm:py-2 rounded-lg hover:bg-red-50 transition-all cursor-pointer transform hover:scale-105 active:scale-95 text-sm sm:text-base"
        >
          <span>🔁</span>
          <span>Retake</span>
        </button>
      </div>
    </div>
  );
};
// END: ImagePreview Component

export default ImagePreview;
