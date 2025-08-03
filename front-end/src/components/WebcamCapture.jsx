import React, { useState, useEffect } from "react";
import Webcam from "react-webcam";

const WebcamCapture = ({ webcamRef, onCapture, onBack }) => {
  const [facingMode, setFacingMode] = useState("environment"); // Start with rear camera
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Always default to rear camera on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setFacingMode("environment");
    }
  }, []);

  // Simplified video constraints - more compatible with mobile
  const videoConstraints = {
    facingMode: facingMode,
    width: { min: 640, ideal: 1280, max: 1920 },
    height: { min: 480, ideal: 720, max: 1080 },
  };

  const handleUserMedia = () => {
    setIsLoading(false);
    setCameraError(null);
  };

  const handleUserMediaError = (error) => {
    setIsLoading(false);
    console.error("Camera error:", error);
    setCameraError(error.message || "Camera access denied or unavailable");
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const requestCameraPermission = async () => {
    try {
      setIsLoading(true);
      setCameraError(null);

      // Request permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      });

      // Stop the stream immediately - we just wanted to test permissions
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error("Permission error:", error);
      setCameraError(
        "Camera permission required. Please allow camera access and try again."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-md">
        <div className="relative rounded-lg overflow-hidden shadow-lg">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 absolute top-2 left-2 rounded z-10">
            📷 Position ingredients clearly
          </div>

          {/* Camera switch button */}
          <button
            onClick={switchCamera}
            className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 absolute top-2 right-2 rounded z-10 hover:bg-opacity-70"
          >
            🔄 Switch
          </button>

          <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg overflow-hidden">
            {cameraError ? (
              <div className="text-center p-4">
                <div className="text-red-400 mb-4">❌ {cameraError}</div>
                <button
                  onClick={requestCameraPermission}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  🔄 Retry Camera Access
                </button>
              </div>
            ) : isLoading ? (
              <div className="text-white text-center">
                <div className="animate-spin text-2xl mb-2">⏳</div>
                <div>Loading camera...</div>
              </div>
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                mirrored={facingMode === "user"} // Mirror only for front camera
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={onCapture}
          disabled={cameraError || isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium shadow-md transition-all transform hover:scale-105 cursor-pointer"
        >
          📸 Capture Photo
        </button>
        <button
          onClick={onBack}
          className="text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
        >
          🔙 Back
        </button>
      </div>
    </div>
  );
};

export default WebcamCapture;
