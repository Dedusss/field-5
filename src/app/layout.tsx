import type { Metadata } from "next";
import { Onest, JetBrains_Mono, Cormorant, Unbounded } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ПОЛЕ ОПЫТОВ — пять экспериментов о будущем веба",
  description:
    "Исследовательский проект: пять радикально разных экспериментальных сайтов — raymarching-пустошь, генеративный звуковой сад, 3D-архив невозможного, кинетическая типографика и коллективный организм. WebGL2, Web Audio, three.js, собственные движки.",
  keywords: [
    "WebGL",
    "raymarching",
    "Web Audio",
    "three.js",
    "кинетическая типографика",
    "генеративный арт",
    "экспериментальный веб",
  ],
  authors: [{ name: "Савелий Гарбес" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${onest.variable} ${jetbrainsMono.variable} ${cormorant.variable} ${unbounded.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
