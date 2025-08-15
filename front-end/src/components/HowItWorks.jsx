import React from "react";

// START: HowItWorks Component
const HowItWorks = () => (
  <div className="text-gray-700 bg-gradient-to-r from-blue-50 to-green-50 p-4 sm:p-6 rounded-xl shadow-sm space-y-3 sm:space-y-4 mx-4 sm:mx-0">
    <h2 className="text-lg sm:text-xl font-bold text-blue-800 text-center flex items-center justify-center gap-2">
      📋 How It Works
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
      <div className="space-y-2 p-2">
        <div className="text-2xl sm:text-3xl">📷</div>
        <h3 className="font-semibold text-sm sm:text-base">1. Capture</h3>
        <p className="text-xs sm:text-sm text-gray-600">
          Take a clear photo of the ingredients list
        </p>
      </div>
      <div className="space-y-2 p-2">
        <div className="text-2xl sm:text-3xl">🤖</div>
        <h3 className="font-semibold text-sm sm:text-base">2. AI Analysis</h3>
        <p className="text-xs sm:text-sm text-gray-600">
          Our AI reads and analyzes each ingredient
        </p>
      </div>
      <div className="space-y-2 p-2">
        <div className="text-2xl sm:text-3xl">📊</div>
        <h3 className="font-semibold text-sm sm:text-base">3. Health Score</h3>
        <p className="text-xs sm:text-sm text-gray-600">
          Get instant health insights and recommendations
        </p>
      </div>
    </div>
    <div className="text-center text-xs sm:text-sm text-gray-600 bg-white p-3 rounded-lg shadow-sm">
      💡 <strong>Tip:</strong> Focus only on the ingredients section for best
      results
    </div>
  </div>
);
// END: HowItWorks Component

export default HowItWorks;
