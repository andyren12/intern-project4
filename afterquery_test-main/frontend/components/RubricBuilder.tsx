"use client";

import { useState } from "react";
import { RubricCriterion } from "@/utils/grading-api";

interface RubricBuilderProps {
  onCriteriaChange: (criteria: RubricCriterion[]) => void;
  initialCriteria?: RubricCriterion[];
}

const DEFAULT_CRITERION: RubricCriterion = {
  name: "",
  description: "",
  weight: 0.33,
  type: "automated",
  scoring: "percentage",
  max_score: 100,
};

export default function RubricBuilder({ onCriteriaChange, initialCriteria }: RubricBuilderProps) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initialCriteria && initialCriteria.length > 0
      ? initialCriteria
      : [{ ...DEFAULT_CRITERION }]
  );

  const updateCriteria = (newCriteria: RubricCriterion[]) => {
    setCriteria(newCriteria);
    onCriteriaChange(newCriteria);
  };

  const addCriterion = () => {
    updateCriteria([...criteria, { ...DEFAULT_CRITERION }]);
  };

  const removeCriterion = (index: number) => {
    updateCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    updateCriteria(updated);
  };

  const totalWeight = criteria.reduce((sum, c) => sum + (parseFloat(String(c.weight)) || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">AI Grading Criteria</h3>
        <button
          type="button"
          onClick={addCriterion}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Criterion
        </button>
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <div key={index} className="border border-gray-300 rounded p-4 space-y-3">
            <div className="flex justify-between items-start">
              <h4 className="font-medium text-gray-700">Criterion {index + 1}</h4>
              {criteria.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCriterion(index)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Criterion Name
                </label>
                <input
                  type="text"
                  value={criterion.name}
                  onChange={(e) => updateCriterion(index, "name", e.target.value)}
                  placeholder="e.g., code_quality"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (0-1)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={criterion.weight}
                  onChange={(e) => updateCriterion(index, "weight", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.33"
                />
                <p className="text-xs text-gray-500 mt-1">{(criterion.weight * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (AI Instructions)
              </label>
              <textarea
                value={criterion.description}
                onChange={(e) => updateCriterion(index, "description", e.target.value)}
                placeholder="Describe what the AI should evaluate for this criterion..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className={`text-sm font-medium ${isWeightValid ? "text-green-600" : "text-red-600"}`}>
        Total Weight: {(totalWeight * 100).toFixed(0)}% {isWeightValid ? "✓" : "⚠ Must equal 100%"}
      </div>

      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3">
        <strong>Note:</strong> All criteria use AI scoring (0-100 scale). Scores are weighted to produce a final score out of 100.
      </div>
    </div>
  );
}
