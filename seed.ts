/**
 * LMS Database Reset & Seed Script
 * Production-ready script for development environment only.
 *
 * Usage: npm run db:reset  OR  npx tsx seed.ts
 * Requires: MONGODB_URI or MONGODB_CONNECTION_STRING in .env.local
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

// Load environment variables from .env.local (Next.js convention) or .env
config({ path: ".env.local" });
config({ path: ".env" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeedResult {
  users: { admin: mongoose.Types.ObjectId; instructor: mongoose.Types.ObjectId; student: mongoose.Types.ObjectId };
  category: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  module: mongoose.Types.ObjectId;
  lesson: mongoose.Types.ObjectId;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NODE_ENV = process.env.NODE_ENV || "development";
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
const BCRYPT_ROUNDS = 12;
const LOG_PREFIX = "[SEED]";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string, level: "info" | "success" | "warn" | "error" = "info"): void {
  const timestamp = new Date().toISOString();
  const prefix = `${LOG_PREFIX} [${timestamp}]`;
  switch (level) {
    case "success":
      console.log(`\x1b[32m${prefix} ✓ ${msg}\x1b[0m`);
      break;
    case "warn":
      console.warn(`\x1b[33m${prefix} ⚠ ${msg}\x1b[0m`);
      break;
    case "error":
      console.error(`\x1b[31m${prefix} ✗ ${msg}\x1b[0m`);
      break;
    default:
      console.log(`${prefix} ${msg}`);
  }
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// ---------------------------------------------------------------------------
// Safety Check
// ---------------------------------------------------------------------------

function assertDevelopment(): void {
  if (NODE_ENV === "production") {
    log(
      "Refusing to run in production. Set NODE_ENV=development to allow database reset.",
      "error"
    );
    process.exit(1);
  }
  log(`Environment: ${NODE_ENV} (safe to proceed)`);
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

async function connect(): Promise<void> {
  if (!MONGODB_URI) {
    log("Missing MONGODB_URI or MONGODB_CONNECTION_STRING in environment.", "error");
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    log("Connected to MongoDB");
  } catch (err) {
    log(`Connection failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    process.exit(1);
  }
}

async function disconnect(): Promise<void> {
  try {
    await mongoose.disconnect();
    log("Disconnected from MongoDB");
  } catch (err) {
    log(`Disconnect error: ${err instanceof Error ? err.message : String(err)}`, "warn");
  }
}

// ---------------------------------------------------------------------------
// Model Imports (registers models with Mongoose)
// ---------------------------------------------------------------------------

async function loadModels(): Promise<void> {
  await import("./model/user-model");
  await import("./model/category-model");
  await import("./model/course-model");
  await import("./model/module.model");
  await import("./model/lesson.model");
  await import("./model/enrollment-model");
  await import("./model/quizv2-model");
  await import("./model/questionv2-model");
  await import("./model/payment-model");
  await import("./model/testimonial-model");
  log("Models loaded");
}

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

async function seed(): Promise<SeedResult> {
  const { User } = await import("./model/user-model");
  const { Category } = await import("./model/category-model");
  const { Course } = await import("./model/course-model");
  const { Module } = await import("./model/module.model");
  const { Lesson } = await import("./model/lesson.model");
  const { Enrollment } = await import("./model/enrollment-model");
  const { Quiz } = await import("./model/quizv2-model");
  const { Question } = await import("./model/questionv2-model");
  const { Payment } = await import("./model/payment-model");
  const { Testimonial } = await import("./model/testimonial-model");

  const plainPassword = "Password123!";
  const hashedPassword = await hashPassword(plainPassword);

  log("Creating users (Admin, Instructor, Student)...");
  const [adminUser, instructorUser, studentUser] = await User.create([
    {
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin",
      status: "active",
    },
    {
      firstName: "Jane",
      lastName: "Instructor",
      email: "instructor@example.com",
      password: hashedPassword,
      role: "instructor",
      status: "active",
    },
    {
      firstName: "John",
      lastName: "Student",
      email: "student@example.com",
      password: hashedPassword,
      role: "student",
      status: "active",
    },
  ]);
  log(`Created users: admin@example.com, instructor@example.com, student@example.com (password: ${plainPassword})`, "success");

  log("Creating category...");
  const category = await Category.create({
    title: "Web Development",
    description: "Learn modern web development",
    thumbnail: "/assets/images/categories/webdev.jpg",
  });
  log("Category created", "success");

  log("Creating course...");
  const course = await Course.create({
    title: "Introduction to Next.js",
    subtitle: "Build modern React applications",
    description: "A comprehensive course on Next.js App Router, server components, and full-stack patterns.",
    thumbnail: "/assets/images/courses/default.jpg",
    price: 49.99,
    active: true,
    category: category._id,
    instructor: instructorUser._id,
    learning: ["Next.js basics", "App Router", "Server Components", "API Routes"],
  });
  log("Course created", "success");

  log("Creating lesson...");
  const lesson = await Lesson.create({
    title: "Getting Started",
    description: "Introduction to the course",
    duration: 300,
    video_url: "",
    active: true,
    slug: "getting-started",
    access: "private",
    order: 0,
  });
  log("Lesson created", "success");

  log("Creating module...");
  const module_ = await Module.create({
    title: "Module 1: Fundamentals",
    description: "Core concepts",
    active: true,
    slug: "module-1",
    course: course._id,
    lessonIds: [lesson._id],
    order: 0,
  });
  log("Module created", "success");

  await Course.findByIdAndUpdate(course._id, { $push: { modules: module_._id } });

  log("Creating enrollment...");
  await Enrollment.create({
    course: course._id,
    student: studentUser._id,
    status: "in-progress",
    method: "free",
  });
  log("Enrollment created", "success");

  log("Creating quiz...");
  const quiz = await Quiz.create({
    courseId: course._id,
    lessonId: lesson._id,
    title: "Quiz 1: Basics",
    description: "Test your understanding",
    published: true,
    createdBy: instructorUser._id,
  });

  await Question.create({
    quizId: quiz._id,
    type: "single",
    text: "What is Next.js?",
    options: [
      { id: "a", text: "A React framework" },
      { id: "b", text: "A database" },
    ],
    correctOptionIds: ["a"],
    order: 0,
  });
  log("Quiz and question created", "success");

  log("Creating payment record...");
  const sessionId = `cs_seed_${Date.now()}`;
  await Payment.create({
    user: studentUser._id,
    course: course._id,
    amount: 49.99,
    currency: "USD",
    status: "succeeded",
    provider: "stripe",
    sessionId,
    paidAt: new Date(),
  });
  log("Payment created", "success");

  log("Creating testimonial...");
  await Testimonial.create({
    content: "Great course! Very comprehensive.",
    rating: 5,
    courseId: course._id,
    user: studentUser._id,
  });
  log("Testimonial created", "success");

  return {
    users: {
      admin: adminUser._id,
      instructor: instructorUser._id,
      student: studentUser._id,
    },
    category: category._id,
    course: course._id,
    module: module_._id,
    lesson: lesson._id,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log("========================================");
  log("  LMS Database Reset & Seed");
  log("========================================");

  assertDevelopment();

  try {
    await connect();
    await loadModels();

    log("Dropping database...");
    await mongoose.connection.dropDatabase();
    log("Database dropped", "success");

    await seed();

    log("========================================");
    log("  Seed completed successfully");
    log("========================================");
    log("Login credentials (all use password: Password123!):");
    log("  Admin:      admin@example.com");
    log("  Instructor: instructor@example.com");
    log("  Student:    student@example.com");
    log("========================================");

    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log(`Seed failed: ${msg}`, "error");
    if (stack) console.error(stack);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
