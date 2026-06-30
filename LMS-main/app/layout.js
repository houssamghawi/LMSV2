import localFont from "next/font/local";
import { Inter, Cairo } from "next/font/google";
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

const poppins = Inter({ subsets: ["latin"], variable: "--font-poppins" });

const cairo = Cairo({
  subsets: ["latin", "arabic"],
  variable: "--font-cairo",
});

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
          poppins.variable,
          cairo.variable,
          "antialiased",
          locale === "ar" && "font-cairo"
        )}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
