// Integration test for the Short Answer grading flow (T018).
//
// Flow under test:
//   - Instructor creates a quiz with MCQ + SA questions
//   - Student submits an attempt → attempt enters `pending_grading`
//   - Auto-graded MCQ/TF answers have their awardedPoints set immediately
//   - Instructor grades SA responses one at a time (autosave per response)
//   - When the last SA response is graded → auto-finalization:
//       status -> "submitted", score/scorePercent/passed recomputed,
//       finalizedAt and finalizedBy set
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import { seedUser, seedCourse } from "../helpers/fixtures.js";

import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { Attempt } from "@/model/attemptv2-model";
import { submitAttempt, gradeShortAnswerResponse } from "@/app/actions/quizv2";
import { getPendingGradingAttempts, getPendingGradingCount } from "@/queries/quizv2";

let instructor, student, course, quiz, mcqQuestion, saQuestion1, saQuestion2;

beforeEach(async () => {
  instructor = await seedUser({ role: "instructor", email: "instr@example.com" });
  student = await seedUser({ role: "student", email: "student@example.com" });
  course = await seedCourse(instructor._id);
  quiz = await Quiz.create({
    courseId: course._id,
    title: "SA Quiz",
    passPercent: 50,
    createdBy: instructor._id,
    published: true
  });
  mcqQuestion = await Question.create({
    quizId: quiz._id,
    type: "single",
    text: "Pick A",
    options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
    correctOptionIds: ["a"],
    points: 4,
    order: 0
  });
  saQuestion1 = await Question.create({
    quizId: quiz._id,
    type: "short_answer",
    text: "Explain X",
    options: [],
    correctOptionIds: [],
    modelAnswer: "X is the process.",
    points: 3,
    order: 1
  });
  saQuestion2 = await Question.create({
    quizId: quiz._id,
    type: "short_answer",
    text: "Explain Y",
    options: [],
    correctOptionIds: [],
    modelAnswer: "Y is the outcome.",
    points: 3,
    order: 2
  });
});

describe("T018 — SA grading flow with auto-finalization", () => {
  it("routes SA quizzes to pending_grading and auto-grades MCQ at submit", async () => {
    setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });

    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });

    const result = await submitAttempt(attempt._id.toString(), {
      [mcqQuestion._id.toString()]: ["a"],
      [saQuestion1._id.toString()]: "X regulates temperature.",
      [saQuestion2._id.toString()]: "Y is the energy yield."
    });

    expect(result.ok).toBe(true);
    const fresh = await Attempt.findById(attempt._id).lean();
    expect(fresh.status).toBe("pending_grading");
    expect(fresh.hasShortAnswers).toBe(true);
    expect(fresh.pendingGradingCount).toBe(2);
    // MCQ auto-graded
    const mcqAnswer = fresh.answers.find(
      (a) => a.questionId.toString() === mcqQuestion._id.toString()
    );
    expect(mcqAnswer.graded).toBe(true);
    expect(mcqAnswer.awardedPoints).toBe(4);
    // SA not graded yet
    const saAnswer = fresh.answers.find(
      (a) => a.questionId.toString() === saQuestion1._id.toString()
    );
    expect(saAnswer.graded).toBe(false);
    expect(saAnswer.awardedPoints).toBe(null);
    expect(saAnswer.textResponse).toContain("temperature");
  });

  it("instructor can grade one SA response (autosave), attempt stays pending_grading", async () => {
    setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });
    await submitAttempt(attempt._id.toString(), {
      [mcqQuestion._id.toString()]: ["a"],
      [saQuestion1._id.toString()]: "X regulates temperature.",
      [saQuestion2._id.toString()]: "Y is the energy yield."
    });

    setLoggedInUser({ id: instructor._id.toString(), role: "instructor", email: instructor.email });
    const grade1 = await gradeShortAnswerResponse(attempt._id.toString(), saQuestion1._id.toString(), {
      awardedPoints: 2,
      graderComment: "Partial credit."
    });
    expect(grade1.ok).toBe(true);
    expect(grade1.finalized).toBe(false);
    expect(grade1.pendingGradingCount).toBe(1);

    const fresh = await Attempt.findById(attempt._id).lean();
    expect(fresh.status).toBe("pending_grading");
    expect(fresh.pendingGradingCount).toBe(1);
    const saAnswer = fresh.answers.find(
      (a) => a.questionId.toString() === saQuestion1._id.toString()
    );
    expect(saAnswer.graded).toBe(true);
    expect(saAnswer.awardedPoints).toBe(2);
    expect(saAnswer.graderComment).toBe("Partial credit.");
  });

  it("auto-finalizes when the last SA response is graded", async () => {
    setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });
    await submitAttempt(attempt._id.toString(), {
      [mcqQuestion._id.toString()]: ["a"],
      [saQuestion1._id.toString()]: "X regulates temperature.",
      [saQuestion2._id.toString()]: "Y is the energy yield."
    });

    setLoggedInUser({ id: instructor._id.toString(), role: "instructor", email: instructor.email });
    await gradeShortAnswerResponse(attempt._id.toString(), saQuestion1._id.toString(), {
      awardedPoints: 3,
      graderComment: ""
    });
    const grade2 = await gradeShortAnswerResponse(attempt._id.toString(), saQuestion2._id.toString(), {
      awardedPoints: 3,
      graderComment: ""
    });

    expect(grade2.ok).toBe(true);
    expect(grade2.finalized).toBe(true);

    const fresh = await Attempt.findById(attempt._id).lean();
    expect(fresh.status).toBe("submitted");
    expect(fresh.pendingGradingCount).toBe(0);
    expect(fresh.finalizedAt).toBeTruthy();
    expect(fresh.finalizedBy.toString()).toBe(instructor._id.toString());
    // Total: 4 (MCQ) + 3 + 3 = 10 of 10 → 100% → passed
    expect(fresh.score).toBe(10);
    expect(fresh.scorePercent).toBe(100);
    expect(fresh.passed).toBe(true);
  });

  it("gradeShortAnswerResponse is idempotent on already-graded answers", async () => {
    setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });
    await submitAttempt(attempt._id.toString(), {
      [mcqQuestion._id.toString()]: ["a"],
      [saQuestion1._id.toString()]: "X regulates temperature.",
      [saQuestion2._id.toString()]: "Y is the energy yield."
    });

    setLoggedInUser({ id: instructor._id.toString(), role: "instructor", email: instructor.email });
    const first = await gradeShortAnswerResponse(attempt._id.toString(), saQuestion1._id.toString(), {
      awardedPoints: 3
    });
    expect(first.ok).toBe(true);
    // Second call on the same answer should not double-decrement
    const second = await gradeShortAnswerResponse(attempt._id.toString(), saQuestion1._id.toString(), {
      awardedPoints: 1
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyGraded).toBe(true);
    const fresh = await Attempt.findById(attempt._id).lean();
    expect(fresh.pendingGradingCount).toBe(1); // still 1, not 0
  });

  it("getPendingGradingAttempts returns the pending attempt for the instructor", async () => {
    setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });
    await submitAttempt(attempt._id.toString(), {
      [mcqQuestion._id.toString()]: ["a"],
      [saQuestion1._id.toString()]: "X regulates temperature.",
      [saQuestion2._id.toString()]: "Y is the energy yield."
    });

    const result = await getPendingGradingAttempts({
      userId: instructor._id.toString(),
      role: "instructor",
      page: 1,
      limit: 10
    });
    expect(result.total).toBe(1);
    expect(result.items[0].quizId).toBeTruthy();
    expect(result.items[0].pendingGradingCount).toBe(2);

    const counts = await getPendingGradingCount(instructor._id.toString(), "instructor");
    expect(counts.total).toBe(1);
  });

  it("rejects grading when attempt is not in pending_grading", async () => {
    setLoggedInUser({ id: instructor._id.toString(), role: "instructor", email: instructor.email });
    const attempt = await Attempt.create({
      quizId: quiz._id,
      studentId: student._id,
      status: "in_progress"
    });
    const res = await gradeShortAnswerResponse(attempt._id.toString(), saQuestion1._id.toString(), {
      awardedPoints: 3
    });
    expect(res.ok).toBe(false);
  });
});
