import React from "react";

const AnalysisResult = ({
  analysis,
  healthScore,
  allergens,
  processingTime,
}) => {
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score) => {
    if (score >= 80) return "bg-green-50";
    if (score >= 60) return "bg-yellow-50";
    return "bg-red-50";
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Health Score Card */}
      {healthScore && (
        <div
          className={`${getScoreBg(healthScore.score)} p-4 sm:p-6 rounded-xl border shadow-sm`}
        >
          <div className="text-center">
            <div
              className={`text-3xl sm:text-4xl font-bold ${getScoreColor(
                healthScore.score
              )}`}
            >
              {healthScore.score}/100
            </div>
            <div className="text-sm sm:text-base text-gray-600 mt-1">Health Score</div>
            {processingTime && (
              <div className="text-xs sm:text-sm text-gray-500 mt-2">
                ⚡ Analyzed in {processingTime}ms
              </div>
            )}
          </div>
        </div>
      )}

      {/* Allergens Alert */}
      {allergens && allergens.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-red-800 mb-3 text-sm sm:text-base">⚠️ Allergen Alert</h3>
          <div className="flex flex-wrap gap-2">
            {allergens.map((allergen, idx) => (
              <span
                key={idx}
                className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
              >
                {allergen}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      <div className="bg-gray-50 p-4 sm:p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="font-semibold text-green-800 text-base sm:text-lg flex items-center gap-2">
          🧠 Detailed Analysis
          <span className="text-xs sm:text-sm font-normal text-gray-600">
            ({analysis?.length || 0} ingredients)
          </span>
        </h2>

        <div className="grid gap-3 sm:gap-4">
          {Array.isArray(analysis) &&
            analysis.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base flex-1">
                    {item.ingredient}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      item.status === "Good"
                        ? "bg-green-100 text-green-800"
                        : item.status === "Bad"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{item.reason}</p>
                {item.concerns && item.concerns.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.concerns.map((concern, cidx) => (
                      <span
                        key={cidx}
                        className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs"
                      >
                        {concern}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
