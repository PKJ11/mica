import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import HomeClient from "./HomeClient";
import "./home.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"] });

export const metadata: Metadata = {
  title: "Kartik Girish Vyas — Courses",
  description: "Your course, your materials, all in one place.",
};

export default function HomePage() {
  return <HomeClient fontClass={montserrat.className} />;
}
