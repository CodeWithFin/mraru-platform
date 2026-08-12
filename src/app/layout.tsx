import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pro Finance - Invest for the Future | Mraru Chama",
  description: "Official Mraru Chama onboarding, governance, and capital management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white text-neutral-900 antialiased selection:bg-[#ccf32f] selection:text-black font-sans">
        {children}
      </body>
    </html>
  );
}
