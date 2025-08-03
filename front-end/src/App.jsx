// App.jsx
import React, { useRef, useState } from "react";
import WebcamCapture from "./components/WebcamCapture";
import ImageUploader from "./components/ImageUploader";
import ModeSelection from "./components/ModeSelection";
import ImagePreview from "./components/ImagePreview";
import AnalysisResult from "./components/AnalysisResult";
import HowItWorks from "./components/HowItWorks";

// START: Main App Component
function App() {
  const webcamRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [mode, setMode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Enhanced state for background processing
  const [processingState, setProcessingState] = useState({
    isProcessing: false,
    status: "",
    progress: 0,
    ocrText: null,
    analysisPromise: null,
  });

  const [analysisReady, setAnalysisReady] = useState(false);
  const [fullResults, setFullResults] = useState(null);

  // Background processing function
  const startBackgroundProcessing = async (imageData) => {
    setProcessingState({
      isProcessing: true,
      status: "📝 Extracting text...",
      progress: 20,
      ocrText: null,
      analysisPromise: null,
    });

    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

      // Send image to backend
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "Server responded with an error",
          code: "UNKNOWN",
        }));

        console.error("🔴 Analysis failed:", errorData);

        setProcessingState((prev) => ({
          ...prev,
          status: `❌ ${errorData.error || "Analysis failed"}`,
          progress: 0,
        }));

        // Optional: show a popup message
        setErrorMessage(`❌ Analysis failed, kindly try again.`);

        // Stop processing after 3 seconds
        setTimeout(() => {
          setProcessingState((prev) => ({
            ...prev,
            isProcessing: false,
          }));
        }, 3000);

        return;
      }

      const result = await response.json();

      setProcessingState((prev) => ({
        ...prev,
        status: "✅ Analysis complete!",
        progress: 100,
        ocrText: result.ingredientsText,
        analysisPromise: Promise.resolve(result),
      }));

      setFullResults(result);
      setAnalysisReady(true);

      setTimeout(() => {
        setProcessingState((prev) => ({
          ...prev,
          isProcessing: false,
        }));
      }, 2000);
    } catch (error) {
      console.error("🔴 Background processing error:", error.message);

      setProcessingState((prev) => ({
        ...prev,
        status: "❌ Failed to reach server",
        progress: 0,
      }));

      setErrorMessage(
        "❌ Could not reach the server. Please check your connection."
      );

      setTimeout(() => {
        setProcessingState((prev) => ({
          ...prev,
          isProcessing: false,
        }));
      }, 3000);
    }
  };

  // Capture image and start background processing
  const captureImage = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setImageSrc(imageSrc);
      startBackgroundProcessing(imageSrc);
    } else {
      setErrorMessage(
        "❌ Could not capture image. Please allow camera access."
      );
    }
  };

  // Handle file upload and start background processing
  const handleUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSrc(reader.result);
      startBackgroundProcessing(reader.result);
    };
    if (file) reader.readAsDataURL(file);
  };

  // Instant analysis (results already ready!)
  const analyzeImage = async () => {
    if (analysisReady && fullResults) {
      // Results are ready - show them instantly!
      setAnalysis(fullResults.analysis);
    } else if (processingState.analysisPromise) {
      // Still processing - wait for completion
      try {
        const response = await processingState.analysisPromise;
        setFullResults(response);
        setAnalysis(response.analysis);
        setAnalysisReady(true);
      } catch (error) {
        console.error("Error analyzing image:", error);
        alert("Failed to analyze image. Please try again.");
      }
    }
  };

  const reset = () => {
    setImageSrc(null);
    setAnalysis(null);
    setMode(null);
    setAnalysisReady(false);
    setFullResults(null);
    setProcessingState({
      isProcessing: false,
      status: "",
      progress: 0,
      ocrText: null,
      analysisPromise: null,
    });
    setErrorMessage(null);
  };
  console.log("🌐 API URL in production:", import.meta.env.VITE_API_URL);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-2 sm:p-4 font-sans">
      <div className="max-w-4xl mx-auto shadow-2xl bg-white rounded-3xl p-4 sm:p-8 space-y-6 sm:space-y-8">
        <a href="/" className="block">
          {/* Enhanced Header with better spacing, icon and subtle animations */}
          <div className="text-center space-y-2 py-2">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V8.5C15 9.6 14.1 10.5 13 10.5S11 9.6 11 8.5V7.5L9 7.5V8.5C9 9.6 8.1 10.5 7 10.5S5 9.6 5 8.5V7.5L3 7V9C3 10.1 3.9 11 5 11V12.5C5 13.6 5.9 14.5 7 14.5S9 13.6 9 12.5V11H15V12.5C15 13.6 15.9 14.5 17 14.5S19 13.6 19 12.5V11C20.1 11 21 10.1 21 9ZM7.5 18C7.5 18.8 8.2 19.5 9 19.5S10.5 18.8 10.5 18V16.5H13.5V18C13.5 18.8 14.2 19.5 15 19.5S16.5 18.8 16.5 18V16.5H7.5V18Z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-700 via-slate-700 to-green-700 bg-clip-text text-transparent leading-tight animate-pulse">
                <span className="inline-block transform hover:scale-105 transition-all duration-500 hover:text-blue-800">
                  AI
                </span>
                <span className="mx-2">Ingredient</span>
                <span className="inline-block transform hover:scale-105 transition-all duration-500 hover:text-green-800">
                  Analyzer
                </span>
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-700 font-medium opacity-90 hover:opacity-100 transition-opacity duration-300">
              Instant health analysis of food ingredients
            </p>
          </div>
        </a>

        {!mode && <HowItWorks />}
        {!mode && <ModeSelection setMode={setMode} />}

        {mode === "camera" && !imageSrc && (
          <WebcamCapture
            webcamRef={webcamRef}
            onCapture={captureImage}
            onBack={reset}
          />
        )}

        {mode === "upload" && !imageSrc && (
          <ImageUploader handleUpload={handleUpload} onBack={reset} />
        )}

        {imageSrc && (
          <ImagePreview
            imageSrc={imageSrc}
            onAnalyze={analyzeImage}
            onReset={reset}
            processingState={processingState}
            analysisReady={analysisReady}
          />
        )}
        {errorMessage && (
          <div className="text-red-600 font-medium text-center bg-red-100 border border-red-300 px-4 py-2 rounded-xl shadow-sm animate-pulse">
            {errorMessage}
          </div>
        )}

        {analysis && fullResults && (
          <AnalysisResult
            analysis={analysis}
            healthScore={fullResults.healthScore}
            allergens={fullResults.allergens}
            processingTime={fullResults.processingTime}
          />
        )}
      </div>
    </div>
  );
}
// END: Main App Component

export default App;
