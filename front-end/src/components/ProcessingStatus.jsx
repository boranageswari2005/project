// START: ProcessingStatus Component
const ProcessingStatus = ({ status, progress, ocrText }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 w-full max-w-md">
    <div className="flex items-center gap-3">
      <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      <span className="font-medium text-blue-800 text-sm sm:text-base">{status}</span>
    </div>

    {progress > 0 && (
      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    )}

    {ocrText && (
      <div className="mt-3 p-3 bg-white rounded-lg border shadow-sm">
        <p className="text-xs text-gray-600 mb-1">📝 Detected ingredients:</p>
        <p className="text-xs sm:text-sm text-gray-800 italic line-clamp-2">
          "{ocrText.substring(0, 120)}..."
        </p>
      </div>
    )}
  </div>
);
// END: ProcessingStatus Component
export default ProcessingStatus;
