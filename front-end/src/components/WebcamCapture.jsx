import React from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  width: { ideal: 1920, min: 640 },
  height: { ideal: 1080, min: 480 },
  facingMode: { ideal: "environment" },
  aspectRatio: 16/9
};

const WebcamCapture = ({ webcamRef, onCapture, onBack }) => {
  const handleCapture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    } else {
      alert("❌ Unable to capture image. Please allow camera access.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Card wrapper */}
      <div className="bg-gray-900 rounded-xl sm:rounded-2xl shadow-xl overflow-hidden relative">
        {/* Webcam container */}
        <div className="relative aspect-video bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.8}
            videoConstraints={videoConstraints}
            className="absolute inset-0 w-full h-full object-cover"
            mirrored={false}
          />
          
          {/* Mobile-friendly overlay guides */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner guides */}
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white opacity-50"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white opacity-50"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white opacity-50"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white opacity-50"></div>
            
            {/* Center guide text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm font-medium">
                📋 Focus on ingredients list
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0">
        <button
          onClick={handleCapture}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 sm:px-6 sm:py-2.5 rounded-xl font-medium shadow-lg cursor-pointer hover:bg-blue-700 transition transform hover:scale-105 text-base sm:text-sm"
        >
          <span className="text-lg sm:text-base">📸</span>
          <span>Capture Photo</span>
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 border-2 border-red-300 text-red-600 px-6 py-3 sm:px-6 sm:py-2.5 rounded-xl font-medium shadow-sm cursor-pointer hover:bg-red-50 transition transform hover:scale-105 text-base sm:text-sm"
        >
          <span className="text-lg sm:text-base">🔙</span>
          <span>Back</span>
        </button>
      </div>
      
      {/* Mobile tips */}
      <div className="sm:hidden bg-blue-50 border border-blue-200 rounded-lg p-3 mx-4">
        <p className="text-xs text-blue-800 text-center">
          💡 <strong>Tip:</strong> Hold steady and ensure good lighting for best results
        </p>
      </div>
    </div>
  );
};

export default WebcamCapture;
