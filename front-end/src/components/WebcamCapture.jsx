import React, { useState, useEffect } from "react";
import Webcam from "react-webcam";

const WebcamCapture = ({ webcamRef, onCapture, onBack }) => {
  const [facingMode, setFacingMode] = useState("user");

  // Use 'ideal' instead of 'exact' for broader compatibility
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setFacingMode({ ideal: "environment" }); // Try to prefer rear camera
    }
  }, []);

  const videoConstraints = {
    facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-md">
        <div className="relative rounded-lg overflow-hidden shadow-lg">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 absolute top-2 left-2 rounded z-10">
            📷 Position ingredients clearly
          </div>
          <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg overflow-hidden">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
              onUserMediaError={(err) =>
                console.error("Camera error:", err.message)
              }
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={onCapture}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-all transform hover:scale-105 cursor-pointer"
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
