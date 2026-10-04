import type { Metadata } from "next";
import localFont from "next/font/local";
import HomeClient from "./HomeClient";
import "./home.css";

// Self-hosted (variable font, covers 300–600) so builds don't depend on fetching from Google Fonts.
const montserrat = localFont({ src: "../fonts/montserrat-latin-wght-normal.woff2", weight: "300 600", display: "swap" });

export const metadata: Metadata = {
  title: "Kartik Girish Vyas — Courses",
  description: "Your course, your materials, all in one place.",
};

export default function HomePage() {
  return <HomeClient fontClass={montserrat.className} />;
}
