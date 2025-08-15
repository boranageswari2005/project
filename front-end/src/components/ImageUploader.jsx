import React, { useState } from "react";
import { validateImageFile } from "../utils/imageUtils";

// START: ImageUploader Component
const ImageUploader = ({ handleUpload, onBack }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      validateImageFile(file);
      handleUpload(e);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      setUploading(true);
      validateImageFile(file);
      
      // Create a synthetic event for handleUpload
      const syntheticEvent = {
        target: { files: [file] }
      };
      handleUpload(syntheticEvent);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 sm:px-0">
      <div className="w-full max-w-md relative">
        <div 
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-300 relative ${
            dragOver 
              ? 'border-green-500 bg-green-50' 
              : uploading 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-3 sm:space-y-4">
            <div className={`text-3xl sm:text-4xl transition-transform duration-300 ${dragOver ? 'scale-110' : ''}`}>
              {uploading ? '⏳' : dragOver ? '📥' : '📁'}
            </div>
          <div>
              <p className="text-gray-700 mb-2 font-medium text-sm sm:text-base">
                {uploading ? 'Processing...' : dragOver ? 'Drop image here' : 'Click to select or drag & drop'}
              </p>
              <p className="text-xs text-gray-500">
                Supports JPG, PNG, WebP • Max 10MB
              </p>
          </div>
        </div>
          
          {/* File input */}
        <input
          type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        disabled={uploading}
        className="flex items-center justify-center gap-2 border-2 border-red-300 text-red-600 px-6 py-3 sm:px-4 sm:py-2 rounded-xl font-medium shadow-sm cursor-pointer hover:bg-red-50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-sm"
      >
        <span className="text-lg sm:text-base">🔙</span>
        <span>Back</span>
      </button>
      
      {/* Mobile-specific tips */}
      <div className="sm:hidden bg-green-50 border border-green-200 rounded-lg p-3 w-full max-w-md">
        <p className="text-xs text-green-800 text-center">
          💡 <strong>Best results:</strong> Clear, well-lit photos of ingredient labels
        </p>
      </div>
    </div>
  );
};
// END: ImageUploader Component
export default ImageUploader;
