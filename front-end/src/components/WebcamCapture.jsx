import React from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: { ideal: "environment" },
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
    <div className="space-y-6">
      {/* Card wrapper */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Webcam container */}
        <div className="relative aspect-video bg-black rounded-2xl">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
            mirrored={false}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={handleCapture}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl font-medium shadow hover:bg-blue-700 transition transform hover:scale-105"
        >
          📸 Capture Photo
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 border border-red-300 text-red-600 px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl font-medium shadow-sm hover:bg-red-50 transition transform hover:scale-105"
        >
          🔙 Back
        </button>
      </div>
    </div>
  );
};

export default WebcamCapture;
