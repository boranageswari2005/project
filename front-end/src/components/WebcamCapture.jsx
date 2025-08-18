import React, { useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;

const WebcamCapture = ({ webcamRef, onCapture, onBack }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  // Updated video constraints to use fixed capture size
  const getVideoConstraints = useCallback(() => {
    return {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      facingMode: { ideal: facingMode },
      aspectRatio: { ideal: 16 / 9 },
      frameRate: { ideal: 30, max: 30 },
    };
  }, [facingMode]);

  const handleUserMedia = useCallback(() => {
    setIsReady(true);
    setError(null);
  }, []);

  const handleUserMediaError = useCallback((error) => {
    console.error("Camera error:", error);
    setError("Camera access denied or not available");
    setIsReady(false);
  }, []);

  // Updated capture handler - no width, height or quality options provided so
  // screenshot matches the visible webcam preview size exactly
  const handleCapture = useCallback(() => {
    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        onCapture(imageSrc);
      } else {
        setError("Unable to capture image. Please try again.");
      }
    } catch (error) {
      console.error("Capture error:", error);
      setError("Failed to capture image. Please try again.");
    }
  }, [webcamRef, onCapture]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full">
      {/* Enhanced camera container */}
      <div className="bg-gray-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="relative aspect-video bg-black">
          {!error ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.8}
              width={CAPTURE_WIDTH}
              height={CAPTURE_HEIGHT}
              videoConstraints={getVideoConstraints()}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="absolute inset-0 w-full h-full object-cover"
              mirrored={facingMode === "user"}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white p-6">
                <div className="text-4xl mb-4">📷</div>
                <p className="text-lg font-medium mb-2">Camera Error</p>
                <p className="text-sm opacity-75">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Enhanced overlay guides */}
          {isReady && !error && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner guides */}
              <div className="absolute top-4 left-4 w-8 h-8 border-l-3 border-t-3 border-white opacity-60 rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-8 h-8 border-r-3 border-t-3 border-white opacity-60 rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-8 h-8 border-l-3 border-b-3 border-white opacity-60 rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-8 h-8 border-r-3 border-b-3 border-white opacity-60 rounded-br-lg"></div>

              {/* Center guide */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black bg-opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm">
                  📋 Focus on ingredients list
                </div>
              </div>

              {/* Focus area indicator */}
              <div className="absolute inset-x-8 inset-y-16 border-2 border-dashed border-white opacity-40 rounded-lg"></div>
            </div>
          )}

          {/* Loading indicator */}
          {!isReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-sm">Loading camera...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced button controls */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-2">
        <button
          onClick={handleCapture}
          disabled={!isReady || error}
          className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-4 sm:px-6 sm:py-3 rounded-xl font-semibold shadow-lg cursor-pointer hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-base sm:text-sm"
        >
          <span className="text-xl sm:text-lg">📸</span>
          <span>Capture Photo</span>
        </button>

        {/* Camera switch button for mobile */}
        <button
          onClick={switchCamera}
          disabled={!isReady || error}
          className="flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-4 sm:px-4 sm:py-3 rounded-xl font-medium shadow-md cursor-pointer hover:bg-gray-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <span className="text-lg sm:text-base">🔄</span>
          <span>Switch</span>
        </button>

        <button
          onClick={onBack}
          className="flex items-center justify-center gap-3 border-2 border-red-300 text-red-600 px-8 py-4 sm:px-6 sm:py-3 rounded-xl font-semibold shadow-sm cursor-pointer hover:bg-red-50 transition-all transform hover:scale-105 active:scale-95 text-base sm:text-sm"
        >
          <span className="text-xl sm:text-lg">🔙</span>
          <span>Back</span>
        </button>
      </div>

      {/* Enhanced mobile tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mx-2">
        <div className="text-center">
          <p className="text-sm text-blue-800 font-medium mb-2">
            📱 <strong>Mobile Tips:</strong>
          </p>
          <div className="text-xs text-blue-700 space-y-1">
            <p>• Hold device steady and ensure good lighting</p>
            <p>• Focus camera on ingredients section only</p>
            <p>• Avoid shadows and reflections on the label</p>
            <p>• Use the switch button to change camera</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebcamCapture;
