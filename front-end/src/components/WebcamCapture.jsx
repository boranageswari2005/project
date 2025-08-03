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
    <div className="flex flex-col items-center gap-6 px-4 sm:px-0">
      <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl">
        <div className="aspect-video bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={false}
          />
        </div>
      </div>

      <div className="flex gap-6 flex-wrap justify-center">
        <button
          onClick={handleCapture}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow transition-transform hover:scale-105 cursor-pointer"
        >
          📸 Capture Photo
        </button>
        <button
          onClick={onBack}
          className="text-red-600 border border-red-300 px-6 py-3 rounded-xl hover:bg-red-50 transition cursor-pointer"
        >
          🔙 Back
        </button>
      </div>
    </div>
  );
};

export default WebcamCapture;
