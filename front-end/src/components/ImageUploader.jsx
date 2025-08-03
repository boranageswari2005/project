import React from "react";

// START: ImageUploader Component
const ImageUploader = ({ handleUpload, onBack }) => (
  <div className="flex flex-col items-center gap-6">
    <div className="w-full max-w-md">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors">
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          <div>
            <p className="text-gray-600 mb-2">Click to select an image</p>
            <p className="text-xs text-gray-500">Supports JPG, PNG formats</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
    <button
      onClick={onBack}
      className="text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
    >
      🔙 Back
    </button>
  </div>
);
// END: ImageUploader Component
export default ImageUploader;
