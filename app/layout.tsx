import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storymap Editor Console",
  description:
    "A split-pane prototype: edit a map-driven story chapter and see the result live, with no reload between editing and checking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
