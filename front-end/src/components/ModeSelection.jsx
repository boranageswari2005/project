import React from "react";

// START: ModeSelection Component
const ModeSelection = ({ setMode }) => (
  <div className="flex flex-col items-center gap-4">
    <p className="text-gray-700 text-center mb-2">
      Choose how you'd like to input your product image:
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
      <button
        onClick={() => setMode("camera")}
        className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-md cursor-pointer"
      >
        <div className="text-2xl mb-2">📷</div>
        <div className="font-medium">Take Photo</div>
        <div className="text-xs opacity-90">Use camera</div>
      </button>
      <button
        onClick={() => setMode("upload")}
        className="bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-md cursor-pointer"
      >
        <div className="text-2xl mb-2">🖼️</div>
        <div className="font-medium">Upload Image</div>
        <div className="text-xs opacity-90">From gallery</div>
      </button>
    </div>
  </div>
);
// END: ModeSelection Component

export default ModeSelection;
