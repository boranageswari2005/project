import React from "react";

// START: ModeSelection Component
const ModeSelection = ({ setMode }) => (
  <div className="flex flex-col items-center gap-4 px-4 sm:px-0">
    <p className="text-gray-700 text-center mb-2 text-sm sm:text-base">
      Choose how you'd like to input your product image:
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-md">
      <button
        onClick={() => setMode("camera")}
        className="bg-blue-600 hover:bg-blue-700 text-white py-4 sm:py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg cursor-pointer active:scale-95"
      >
        <div className="text-3xl sm:text-2xl mb-2">📷</div>
        <div className="font-medium text-base sm:text-base">Take Photo</div>
        <div className="text-xs sm:text-xs opacity-90">Use camera</div>
      </button>
      <button
        onClick={() => setMode("upload")}
        className="bg-green-600 hover:bg-green-700 text-white py-4 sm:py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg cursor-pointer active:scale-95"
      >
        <div className="text-3xl sm:text-2xl mb-2">🖼️</div>
        <div className="font-medium text-base sm:text-base">Upload Image</div>
        <div className="text-xs sm:text-xs opacity-90">From gallery</div>
      </button>
    </div>
  </div>
);
// END: ModeSelection Component

export default ModeSelection;
