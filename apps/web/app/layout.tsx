import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Verdict",
  description: "PDF invoice to valid XRechnung. Nemotron proposes, the official KoSIT validator decides.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
