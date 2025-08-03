// START: ProcessingStatus Component
const ProcessingStatus = ({ status, progress, ocrText }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      <span className="font-medium text-blue-800">{status}</span>
    </div>

    {progress > 0 && (
      <div className="w-full bg-blue-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    )}

    {ocrText && (
      <div className="mt-3 p-3 bg-white rounded border">
        <p className="text-xs text-gray-600 mb-1">📝 Detected ingredients:</p>
        <p className="text-sm text-gray-800 italic">
          "{ocrText.substring(0, 100)}..."
        </p>
      </div>
    )}
  </div>
);
// END: ProcessingStatus Component
export default ProcessingStatus;
