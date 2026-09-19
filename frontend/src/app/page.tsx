"use client";

import { Hero } from "@/components/home/Hero";
import { FluidCursor } from "@/components/home/FluidCursor";
import { StatsSection } from "@/components/home/StatsSection";
import { AboutPreview } from "@/components/home/AboutPreview";
import { HowItWorks } from "@/components/home/HowItWorks";
import { GridPreview } from "@/components/home/GridPreview";
import { CTASection } from "@/components/home/CTASection";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <FluidCursor />
      <Navbar variant="transparent" />
      <main>
        <Hero />
        <StatsSection />
        <AboutPreview />
        <HowItWorks />
        <GridPreview />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
