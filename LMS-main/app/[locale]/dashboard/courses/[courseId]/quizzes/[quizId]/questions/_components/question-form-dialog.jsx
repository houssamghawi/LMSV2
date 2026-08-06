"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

export function QuestionFormDialog({ open, onOpenChange, question, onSave }) {
    const t = useTranslations("Quiz");
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            type: "single",
            text: "",
            points: 1,
            explanation: "",
            options: [
                { id: "1", text: "" },
                { id: "2", text: "" }
            ],
            correctOptionIds: []
        }
    });

    const [options, setOptions] = useState([
        { id: "1", text: "" },
        { id: "2", text: "" }
    ]);
    const [correctOptions, setCorrectOptions] = useState([]);

    useEffect(() => {
        if (question) {
            reset({
                type: question.type,
                text: question.text,
                points: question.points || 1,
                explanation: question.explanation || "",
                options: question.options || [],
                correctOptionIds: question.correctOptionIds || []
            });
            setOptions(question.options || []);
            setCorrectOptions(question.correctOptionIds || []);
        } else {
            reset({
                type: "single",
                text: "",
                points: 1,
                explanation: "",
                options: [{ id: "1", text: "" }, { id: "2", text: "" }],
                correctOptionIds: []
            });
            setOptions([{ id: "1", text: "" }, { id: "2", text: "" }]);
            setCorrectOptions([]);
        }
    }, [question, reset, open]);

    const addOption = () => {
        const newId = String(Date.now());
        setOptions([...options, { id: newId, text: "" }]);
    };

    const removeOption = (id) => {
        if (options.length <= 2) return;
        setOptions(options.filter(opt => opt.id !== id));
        setCorrectOptions(correctOptions.filter(optId => optId !== id));
    };

    const updateOption = (id, text) => {
        setOptions(options.map(opt => opt.id === id ? { ...opt, text } : opt));
    };

    const toggleCorrect = (id) => {
        const questionType = watch("type");
        if (questionType === "single" || questionType === "true_false") {
            setCorrectOptions([id]);
        } else {
            if (correctOptions.includes(id)) {
                setCorrectOptions(correctOptions.filter(optId => optId !== id));
            } else {
                setCorrectOptions([...correctOptions, id]);
            }
        }
    };

    const onSubmit = (data) => {
        if (options.filter(opt => opt.text.trim()).length < 2) {
            alert(t("minTwoOptionsAlert"));
            return;
        }

        if (correctOptions.length === 0) {
            alert(t("oneCorrectAlert"));
            return;
        }

        onSave({
            type: data.type,
            text: data.text,
            points: Number(data.points) || 1,
            explanation: data.explanation || "",
            options: options.filter(opt => opt.text.trim()),
            correctOptionIds: correctOptions
        });
    };

    const questionType = watch("type");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{question ? t("editQuestion") : t("addQuestion")}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Question Type */}
                    <div>
                        <Label>{t("questionType")}</Label>
                        <Select
                            defaultValue={questionType}
                            onValueChange={(value) => {
                                setValue("type", value);
                                if (value === "true_false") {
                                    setOptions([
                                        { id: "true", text: t("trueLabel") },
                                        { id: "false", text: t("falseLabel") }
                                    ]);
                                    setCorrectOptions([]);
                                }
                            }}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="single">{t("singleChoice")}</SelectItem>
                                <SelectItem value="multi">{t("multipleChoice")}</SelectItem>
                                <SelectItem value="true_false">{t("trueFalse")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Question Text */}
                    <div>
                        <Label htmlFor="text">{t("questionTextRequired")}</Label>
                        <Textarea
                            id="text"
                            {...register("text", { required: t("questionTextRequiredToast") })}
                            className="mt-1"
                            rows={3}
                        />
                        {errors.text && (
                            <p className="text-sm text-red-600 mt-1">{errors.text.message}</p>
                        )}
                    </div>

                    {/* Points */}
                    <div>
                        <Label htmlFor="points">{t("points")}</Label>
                        <Input
                            id="points"
                            type="number"
                            min="0"
                            step="0.5"
                            {...register("points")}
                            className="mt-1"
                        />
                    </div>

                    {/* Options */}
                    {questionType !== "true_false" && (
                        <div>
                            <Label>{t("optionsRequired")}</Label>
                            <div className="space-y-2 mt-2">
                                {options.map((option, index) => (
                                    <div key={option.id} className="flex items-center gap-2">
                                        <Checkbox
                                            checked={correctOptions.includes(option.id)}
                                            onCheckedChange={() => toggleCorrect(option.id)}
                                        />
                                        <Input
                                            value={option.text}
                                            onChange={(e) => updateOption(option.id, e.target.value)}
                                            placeholder={t("optionNPlaceholder", { n: index + 1 })}
                                            className="flex-1"
                                        />
                                        {options.length > 2 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeOption(option.id)}
                                            >
                                                {t("remove")}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addOption}
                                >
                                    {t("addOption")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* True/False Options */}
                    {questionType === "true_false" && (
                        <div>
                            <Label>{t("correctAnswer")}</Label>
                            <div className="space-y-2 mt-2">
                                {options.map((option) => (
                                    <div key={option.id} className="flex items-center gap-x-2 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={correctOptions.includes(option.id)}
                                            onCheckedChange={() => toggleCorrect(option.id)}
                                        />
                                        <Label className="cursor-pointer">{option.text}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Explanation */}
                    <div>
                        <Label htmlFor="explanation">{t("explanationOptional")}</Label>
                        <Textarea
                            id="explanation"
                            {...register("explanation")}
                            className="mt-1"
                            rows={2}
                            placeholder={t("explanationPlaceholder")}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("cancel")}
                        </Button>
                        <Button type="submit">{t("saveQuestion")}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
