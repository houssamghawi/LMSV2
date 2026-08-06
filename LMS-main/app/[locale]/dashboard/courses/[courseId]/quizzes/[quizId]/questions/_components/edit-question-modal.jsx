"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateQuestion } from "@/app/actions/quizzes";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

export function EditQuestionModal({ question, onClose, onSave }) {
  const t = useTranslations("Quiz");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionText, setQuestionText] = useState(question.questionText || "");
  const [points, setPoints] = useState(question.points?.toString() || "1");
  const [explanation, setExplanation] = useState(question.explanation || "");
  const [options, setOptions] = useState(
    question.options?.length > 0
      ? question.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
        }))
      : [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ]
  );

  const questionType = question.questionType;

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
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === index ? value : false;
      });
    } else {
      newOptions[index][field] = value;
    }

    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!questionText.trim()) {
      toast.error(t("questionTextRequiredToast"));
      return;
    }

    if (questionType !== "short_text") {
      const validOptions = options.filter((opt) => opt.text.trim());
      if (validOptions.length < 2) {
        toast.error(t("minTwoOptions"));
        return;
      }
      const hasCorrect = validOptions.some((opt) => opt.isCorrect);
      if (!hasCorrect) {
        toast.error(t("oneCorrectRequired"));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updateData = {
        questionText: questionText.trim(),
        points: parseInt(points) || 1,
        explanation: explanation.trim(),
        options:
          questionType === "short_text"
            ? []
            : options
                .filter((opt) => opt.text.trim())
                .map((opt, idx) => ({
                  text: opt.text.trim(),
                  isCorrect: opt.isCorrect,
                  order: idx,
                })),
      };

      const result = await updateQuestion(question.id, updateData);

      if (result.ok) {
        toast.success(t("questionUpdated"));
        onSave();
      } else {
        toast.error(result.error || t("failedSaveQuestion"));
      }
    } catch (error) {
      toast.error(t("failedSaveQuestion"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editQuestion")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>{t("questionText")}</Label>
            <Textarea
              placeholder={t("enterQuestionPlaceholder")}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label>{t("points")}</Label>
            <Input
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          {(questionType === "multiple_choice_single" ||
            questionType === "multiple_choice_multiple") && (
            <div>
              <Label className="mb-2 block">{t("options")}</Label>
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
                      placeholder={t("optionNPlaceholder", { n: index + 1 })}
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
                  <Plus className="h-4 w-4 me-1" />
                  {t("addOption")}
                </Button>
              </div>
            </div>
          )}

          {questionType === "true_false" && (
            <div>
              <Label className="mb-2 block">{t("correctAnswer")}</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={options[0]?.isCorrect || false}
                    onCheckedChange={(checked) => {
                      setOptions([
                        { text: t("trueLabel"), isCorrect: checked },
                        { text: t("falseLabel"), isCorrect: !checked },
                      ]);
                    }}
                  />
                  <span>{t("trueCorrect")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={options[1]?.isCorrect || false}
                    onCheckedChange={(checked) => {
                      setOptions([
                        { text: t("trueLabel"), isCorrect: !checked },
                        { text: t("falseLabel"), isCorrect: checked },
                      ]);
                    }}
                  />
                  <span>{t("falseCorrect")}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>{t("explanationOptional")}</Label>
            <Textarea
              placeholder={t("explainPlaceholder")}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t("saving") : t("saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

