import React from "react";

// START: HowItWorks Component
const HowItWorks = () => (
  <div className="text-gray-700 bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl shadow-md space-y-4">
    <h2 className="text-xl font-bold text-blue-800 text-center flex items-center justify-center gap-2">
      📋 How It Works
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
      <div className="space-y-2">
        <div className="text-3xl">📷</div>
        <h3 className="font-semibold">1. Capture</h3>
        <p className="text-sm text-gray-600">
          Take a clear photo of the ingredients list
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-3xl">🤖</div>
        <h3 className="font-semibold">2. AI Analysis</h3>
        <p className="text-sm text-gray-600">
          Our AI reads and analyzes each ingredient
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-3xl">📊</div>
        <h3 className="font-semibold">3. Health Score</h3>
        <p className="text-sm text-gray-600">
          Get instant health insights and recommendations
        </p>
      </div>
    </div>
    <div className="text-center text-sm text-gray-600 bg-white p-3 rounded-lg">
      💡 <strong>Tip:</strong> Focus only on the ingredients section for best
      results
    </div>
  </div>
);
// END: HowItWorks Component

export default HowItWorks;
