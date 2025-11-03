"""
AI Grading Service - Uses OpenAI to analyze code quality and provide automated scoring
"""
from datetime import datetime
from typing import Any
import os
import json
from openai import OpenAI
from ..schemas import CriterionScore, AIGradingResult


class AIGradingService:
    """Service for AI-powered code review and grading"""

    def __init__(self, api_key: str | None = None):
        """Initialize with OpenAI API key"""
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        self.client = OpenAI(api_key=self.api_key)

    def analyze_code_quality(
        self,
        code_diff: dict[str, Any],
        commit_history: list[dict[str, Any]],
        rubric_criteria: list[dict[str, Any]],
        criteria_to_grade: list[str],
        model: str = "gpt-4o-mini",
        assessment_title: str | None = None,
        assessment_description: str | None = None,
        assessment_instructions: str | None = None
    ) -> AIGradingResult:
        """
        Analyze code using AI based on rubric criteria

        Args:
            code_diff: Git diff output from GitHub API
            commit_history: List of commits from candidate
            rubric_criteria: Full rubric definition
            criteria_to_grade: Which criteria should be AI-graded
            model: OpenAI model to use
            assessment_title: Title of the assignment
            assessment_description: Description of what the assignment asks
            assessment_instructions: Detailed instructions for the assignment

        Returns:
            AIGradingResult with scores and reasoning
        """
        # Filter to only AI-gradable criteria
        criteria_to_analyze = [
            c for c in rubric_criteria
            if c["name"] in criteria_to_grade
        ]

        if not criteria_to_analyze:
            raise ValueError("No valid criteria to grade")

        # Build the prompt
        prompt = self._build_grading_prompt(
            code_diff,
            commit_history,
            criteria_to_analyze,
            assessment_title,
            assessment_description,
            assessment_instructions
        )

        # Call OpenAI
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert code reviewer tasked with evaluating programming assignments. Provide objective, constructive feedback based on the given rubric."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,  # Lower temperature for more consistent scoring
                response_format={"type": "json_object"}
            )

            # Parse response
            result_json = json.loads(response.choices[0].message.content)

            # Convert to CriterionScore objects
            criteria_scores = {}
            reasoning = {}

            for criterion_name, data in result_json.get("scores", {}).items():
                criteria_scores[criterion_name] = CriterionScore(
                    score=float(data["score"]),
                    max_score=float(data["max_score"]),
                    notes=data.get("reasoning", "")
                )
                reasoning[criterion_name] = data.get("reasoning", "")

            return AIGradingResult(
                criteria_scores=criteria_scores,
                reasoning=reasoning,
                model_used=model,
                tokens_used=response.usage.prompt_tokens + response.usage.completion_tokens
            )

        except Exception as e:
            raise RuntimeError(f"AI grading failed: {str(e)}")

    def _build_grading_prompt(
        self,
        code_diff: dict[str, Any],
        commit_history: list[dict[str, Any]],
        criteria: list[dict[str, Any]],
        assessment_title: str | None = None,
        assessment_description: str | None = None,
        assessment_instructions: str | None = None
    ) -> str:
        """Build the grading prompt for OpenAI"""

        # Format code changes
        files_changed = code_diff.get("files", [])
        code_summary = self._format_code_diff(files_changed)

        # Format commit history
        commits_summary = self._format_commits(commit_history)

        # Format rubric criteria
        criteria_description = self._format_criteria(criteria)

        # Build assignment context section
        assignment_context = ""
        if assessment_title or assessment_description or assessment_instructions:
            assignment_context = "## ASSIGNMENT CONTEXT\n"
            if assessment_title:
                assignment_context += f"**Assignment Title:** {assessment_title}\n\n"
            if assessment_description:
                assignment_context += f"**Description:** {assessment_description}\n\n"
            if assessment_instructions:
                assignment_context += f"**Instructions:**\n{assessment_instructions}\n\n"

        prompt = f"""
You are grading a programming assignment submission. Analyze the code changes and provide scores based on the rubric below.

{assignment_context}
## CODE CHANGES
{code_summary}

## COMMIT HISTORY
{commits_summary}

## GRADING RUBRIC
{criteria_description}

## INSTRUCTIONS
For each criterion:
1. Review the assignment context to understand what was required
2. Analyze the code thoroughly against the requirements
3. Assign a score based on the criterion's scoring system
4. Provide clear, constructive reasoning that references specific code examples

Return your evaluation as JSON in this exact format:
{{
  "scores": {{
    "criterion_name": {{
      "score": <numeric_score>,
      "max_score": <max_possible_score>,
      "reasoning": "<detailed explanation>"
    }}
  }}
}}

Be objective and fair. Focus on what the code demonstrates, not what's missing unless that's explicitly part of the criterion.
"""
        return prompt

    def _format_code_diff(self, files: list[dict[str, Any]]) -> str:
        """Format git diff into readable summary"""
        if not files:
            return "No code changes found."

        summary = f"Total files changed: {len(files)}\n\n"

        for file_data in files[:20]:  # Limit to 20 files to avoid token limits
            filename = file_data.get("filename", "unknown")
            additions = file_data.get("additions", 0)
            deletions = file_data.get("deletions", 0)
            patch = file_data.get("patch", "")

            summary += f"### File: {filename}\n"
            summary += f"Lines added: {additions}, Lines deleted: {deletions}\n"

            # Include patch if available (truncate if too long)
            if patch:
                patch_preview = patch[:2000] + "..." if len(patch) > 2000 else patch
                summary += f"```diff\n{patch_preview}\n```\n\n"
            else:
                summary += "(No patch available)\n\n"

        if len(files) > 20:
            summary += f"\n... and {len(files) - 20} more files\n"

        return summary

    def _format_commits(self, commits: list[dict[str, Any]]) -> str:
        """Format commit history"""
        if not commits:
            return "No commits found."

        summary = f"Total commits: {len(commits)}\n\n"

        for commit in commits[:10]:  # Show last 10 commits
            sha = commit.get("sha", "")[:7]
            message = commit.get("message", "")
            author = commit.get("author", {}).get("name", "Unknown")
            date = commit.get("date", "")

            summary += f"- [{sha}] {message} (by {author})\n"

        if len(commits) > 10:
            summary += f"\n... and {len(commits) - 10} more commits\n"

        return summary

    def _format_criteria(self, criteria: list[dict[str, Any]]) -> str:
        """Format rubric criteria for the prompt"""
        formatted = ""

        for criterion in criteria:
            name = criterion.get("name", "")
            description = criterion.get("description", "")
            scoring = criterion.get("scoring", "scale")
            max_score = criterion.get("max_score", 5)
            weight = criterion.get("weight", 0)

            formatted += f"### {name}\n"
            formatted += f"**Description:** {description}\n"
            formatted += f"**Scoring:** {scoring} (0-{max_score})\n"
            formatted += f"**Weight:** {weight * 100}%\n\n"

        return formatted

    def estimate_cost(self, code_diff: dict[str, Any], model: str = "gpt-4o-mini") -> dict[str, Any]:
        """
        Estimate cost of AI grading based on code size

        Returns approximate token count and cost in USD
        """
        # Rough estimation: 1 token ≈ 4 characters
        files = code_diff.get("files", [])
        total_chars = sum(len(f.get("patch", "")) for f in files)
        estimated_tokens = total_chars // 4 + 1000  # Add base prompt tokens

        # Pricing (as of 2024)
        pricing = {
            "gpt-4o": {"input": 0.005 / 1000, "output": 0.015 / 1000},
            "gpt-4o-mini": {"input": 0.00015 / 1000, "output": 0.0006 / 1000},
            "gpt-4-turbo": {"input": 0.01 / 1000, "output": 0.03 / 1000},
        }

        model_pricing = pricing.get(model, pricing["gpt-4o-mini"])
        estimated_cost = (
            estimated_tokens * model_pricing["input"] +
            500 * model_pricing["output"]  # Estimate 500 tokens output
        )

        return {
            "estimated_tokens": estimated_tokens,
            "estimated_cost_usd": round(estimated_cost, 4),
            "model": model
        }
