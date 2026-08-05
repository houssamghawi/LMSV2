"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addQuestion } from "@/app/actions/quizzes";
import { Plus, X } from "lucide-react";

export function AddQuestionForm({ quizId }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionType, setQuestionType] = useState("multiple_choice_single");
  const [questionText, setQuestionText] = useState("");
  const [points, setPoints] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  const resetForm = () => {
    setQuestionText("");
    setPoints("1");
    setExplanation("");
    setOptions([
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ]);
  };

  const handleAddOption = () => {
    setOptions([...options, { text: "", isCorrect: false }]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    
    if (field === "isCorrect" && questionType === "multiple_choice_single") {
      // For single choice, only one can be correct
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === index ? value : false;
      });
    } else {
      newOptions[index][field] = value;
    }
    
    setOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }

    // Validate options for MCQ types
    if (questionType !== "short_text") {
      const validOptions = options.filter((opt) => opt.text.trim());
      if (validOptions.length < 2) {
        toast.error("At least 2 options are required");
        return;
      }
      const hasCorrect = validOptions.some((opt) => opt.isCorrect);
      if (!hasCorrect) {
        toast.error("At least one option must be marked as correct");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const questionData = {
        questionText: questionText.trim(),
        questionType,
        points: parseInt(points) || 1,
        explanation: explanation.trim(),
        options:
          questionType === "short_text"
            ? []
            : questionType === "true_false"
            ? [
                { text: "True", isCorrect: options[0]?.isCorrect || false, order: 0 },
                { text: "False", isCorrect: options[1]?.isCorrect || false, order: 1 },
              ]
            : options
                .filter((opt) => opt.text.trim())
                .map((opt, idx) => ({
                  text: opt.text.trim(),
                  isCorrect: opt.isCorrect,
                  order: idx,
                })),
      };

      const result = await addQuestion(quizId, questionData);

      if (result.ok) {
        toast.success("Question added");
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to add question");
      }
    } catch (error) {
      toast.error("Failed to add question");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-slate-50 sticky top-6">
      <h3 className="font-semibold mb-4">Add Question</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Question Type</Label>
          <Select value={questionType} onValueChange={setQuestionType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice_single">Single Choice</SelectItem>
              <SelectItem value="multiple_choice_multiple">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True/False</SelectItem>
              <SelectItem value="short_text">Short Text (Manual Grading)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Question Text</Label>
          <Textarea
            placeholder="Enter your question..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label>Points</Label>
          <Input
            type="number"
            min="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>

        {/* Options for MCQ */}
        {(questionType === "multiple_choice_single" ||
          questionType === "multiple_choice_multiple") && (
          <div>
            <Label className="mb-2 block">
              Options{" "}
              <span className="text-xs text-slate-500">
                ({questionType === "multiple_choice_single"
                  ? "select one correct"
                  : "select all correct"})
              </span>
            </Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={option.isCorrect}
                    onCheckedChange={(checked) =>
                      handleOptionChange(index, "isCorrect", checked)
                    }
                  />
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(e) =>
                      handleOptionChange(index, "text", e.target.value)
                    }
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {/* True/False options */}
        {questionType === "true_false" && (
          <div>
            <Label className="mb-2 block">Correct Answer</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={options[0]?.isCorrect || false}
                  onCheckedChange={(checked) => {
                    setOptions([
                      { text: "True", isCorrect: checked },
                      { text: "False", isCorrect: !checked },
                    ]);
                  }}
                />
                <span>True is correct</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={options[1]?.isCorrect || false}
                  onCheckedChange={(checked) => {
                    setOptions([
                      { text: "True", isCorrect: !checked },
                      { text: "False", isCorrect: checked },
                    ]);
                  }}
                />
                <span>False is correct</span>
              </div>
            </div>
          </div>
        )}

        {questionType === "short_text" && (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            Short text questions require manual grading. The student&apos;s response will
            be recorded but scored as 0 until manually graded.
          </div>
        )}

        <div>
          <Label>Explanation (Optional)</Label>
          <Textarea
            placeholder="Explain the correct answer..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Question"}
        </Button>
      </form>
    </div>
  );
}

