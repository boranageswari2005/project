import React, { useState, useEffect, useRef } from "react";

// No react-webcam import needed - using native browser APIs

const WebcamCapture = ({ webcamRef, onCapture, onBack }) => {
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setFacingMode("environment");
    }

    // Initialize camera when component mounts
    initializeCamera();

    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const videoConstraints = {
    facingMode: facingMode,
    width: { ideal: 640 },
    height: { ideal: 480 },
  };

  const initializeCamera = async () => {
    try {
      setIsLoading(true);
      setCameraError(null);
      console.log("Initializing camera...");

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      // Stop existing stream
      if (stream) {
        console.log("Stopping existing stream");
        stream.getTracks().forEach((track) => track.stop());
      }

      console.log("Requesting camera with constraints:", videoConstraints);

      // Add a timeout to prevent infinite loading
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Camera request timeout")), 10000)
      );

      const newStream = await Promise.race([streamPromise, timeoutPromise]);
      console.log("Camera stream obtained:", newStream);

      setStream(newStream);

      // Attach stream to video element with error handling
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;

        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          setIsLoading(false);
        };

        // Handle video load error
        videoRef.current.onerror = (error) => {
          console.error("Video element error:", error);
          setCameraError("Failed to load camera stream");
          setIsLoading(false);
        };
      } else {
        console.log("Video ref not available, setting loading to false");
        setIsLoading(false);
      }

      // Also attach to webcamRef if provided (for compatibility)
      if (webcamRef && webcamRef.current) {
        webcamRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error("Camera initialization error:", error);
      setIsLoading(false);

      let errorMessage = "Camera access denied or unavailable";

      if (error.message === "Camera request timeout") {
        errorMessage = "Camera is taking too long to load. Please try again.";
      } else if (error.name === "NotAllowedError") {
        errorMessage =
          "Camera permission denied. Please allow camera access and refresh.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera found on this device.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Camera is being used by another application.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage =
          "Camera doesn't support the requested settings. Try switching cameras.";
      }

      setCameraError(errorMessage);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return null;

    const canvas = document.createElement("canvas");
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const handleCapture = () => {
    const imageSrc = capturePhoto();
    if (imageSrc && onCapture) {
      onCapture(imageSrc);
    }
  };

  const retryCamera = () => {
    initializeCamera();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-md">
        <div className="relative rounded-lg overflow-hidden shadow-lg">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 absolute top-2 left-2 rounded z-10">
            📷 Position ingredients clearly
          </div>

          <button
            onClick={switchCamera}
            className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 absolute top-2 right-2 rounded z-10 hover:bg-opacity-70"
            disabled={isLoading || cameraError}
          >
            🔄 Switch
          </button>

          <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg overflow-hidden">
            {cameraError ? (
              <div className="text-center p-4">
                <div className="text-red-400 mb-4 text-sm">
                  ❌ {cameraError}
                </div>
                <button
                  onClick={retryCamera}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  🔄 Retry Camera Access
                </button>
              </div>
            ) : isLoading ? (
              <div className="text-white text-center">
                <div className="animate-spin text-2xl mb-2">⏳</div>
                <div className="text-sm">Loading camera...</div>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => {
                  console.log("Video can play");
                  setIsLoading(false);
                }}
                className={`w-full h-full object-cover ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
                style={{
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={handleCapture}
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
