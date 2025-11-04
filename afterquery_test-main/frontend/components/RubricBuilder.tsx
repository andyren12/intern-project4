"use client";

import { useState } from "react";
import { RubricCriterion } from "@/utils/grading-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">AI Grading Criteria</h3>
        <Button
          type="button"
          onClick={addCriterion}
          variant="outline"
          size="sm"
        >
          + Add Criterion
        </Button>
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">Criterion {index + 1}</CardTitle>
                {criteria.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive text-xl"
                  >
                    ×
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`criterion-name-${index}`}>
                    Criterion Name
                  </Label>
                  <Input
                    id={`criterion-name-${index}`}
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, "name", e.target.value)}
                    placeholder="e.g., code_quality"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`criterion-weight-${index}`}>
                    Weight (0-1)
                  </Label>
                  <Input
                    id={`criterion-weight-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={criterion.weight}
                    onChange={(e) => updateCriterion(index, "weight", parseFloat(e.target.value) || 0)}
                    placeholder="0.33"
                  />
                  <p className="text-xs text-muted-foreground">{(criterion.weight * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`criterion-description-${index}`}>
                  Description (AI Instructions)
                </Label>
                <Textarea
                  id={`criterion-description-${index}`}
                  value={criterion.description}
                  onChange={(e) => updateCriterion(index, "description", e.target.value)}
                  placeholder="Describe what the AI should evaluate for this criterion..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Total Weight:</span>
        <Badge variant={isWeightValid ? "default" : "destructive"}>
          {(totalWeight * 100).toFixed(0)}%
        </Badge>
        {isWeightValid ? (
          <span className="text-sm text-green-600">✓ Valid</span>
        ) : (
          <span className="text-sm text-destructive">⚠ Must equal 100%</span>
        )}
      </div>

      <Alert>
        <AlertDescription>
          <strong>Note:</strong> All criteria use AI scoring (0-100 scale). Scores are weighted to produce a final score out of 100.
        </AlertDescription>
      </Alert>
    </div>
  );
}
