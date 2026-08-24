import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter и JetBrains Mono, а не Geist: нужен кириллический сабсет.
const inter = Inter({
  variable: "--font-app-sans",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  // Без этого превью ссылки в мессенджерах указывает на localhost.
  metadataBase: new URL("https://ecofin-chi.vercel.app"),
  title: "EcoFin — где утекают ресурсы и сколько тенге можно вернуть",
  description:
    "AI-платформа ресурсоэффективности: сравнивает ваше потребление электричества, воды и отходов с региональной нормой и предлагает конкретные шаги с расчётом экономии в тенге.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
