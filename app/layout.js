import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { dbConnect } from "@/service/mongo";
import { getLocale } from "next-intl/server";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Easy Learning Academy - Best Online Professional Courses",
  description: "Best Online Professional Courses",
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();

  try {
    await dbConnect();
  } catch (error) {
    console.error("Database connection error:", error);
  }

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "antialiased",
          "font-inter",
          locale === "ar" && "font-cairo"
        )}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
