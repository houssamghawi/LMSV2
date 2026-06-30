# Learning Management System (LMS)

A modern Learning Management System built with Next.js 15, supporting course creation, student enrollment, quiz management, progress tracking, and certificate generation. Designed for educational institutions and online learning platforms.

## Key Features

- **Role-based Access Control**: Admin, Instructor, and Student roles with appropriate permissions
- **Course Management**: Create courses with modules, lessons, and video content
- **Quiz System**: Create quizzes for courses and lessons with multiple question types and auto-grading
- **Enrollment & Payments**: MockPay integration for simulated payments (demo/testing)
- **Progress Tracking**: Monitor student progress through courses and lessons
- **Certificates**: Generate PDF certificates upon course completion
- **Dashboards**: Comprehensive admin and instructor dashboards with analytics

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Server Actions
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth v5
- **Validation**: Zod, React Hook Form
- **Other**: PDF generation, Video player, Rich text editor, Email service (Resend)

## Quick Start

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd LMS-main
npm install
```

2. Create a `.env` file:
```env
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/lms
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=your-resend-api-key  # Optional
```

3. Run the development server:
```bash
npm run dev
```

4. Visit [http://localhost:3000](http://localhost:3000) and create an admin account at `/setup/admin`

## Payment System

The system uses **MockPay**, a virtual payment system for demonstration and testing. MockPay simulates payment processing without real payment credentials, making it ideal for development and demonstrations. The architecture is designed to easily integrate real payment gateways when needed.

## Project Structure

```
app/          # Next.js pages and routes
  ├── (main)/    # Public pages
  ├── admin/     # Admin dashboard
  ├── dashboard/ # Instructor dashboard
  ├── actions/   # Server actions
  └── api/       # API routes
components/   # React components
lib/          # Utilities and helpers
model/        # Mongoose models
queries/      # Database queries
```

## License

MIT
