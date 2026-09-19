"use client";
import { useEffect, useRef, useState } from "react";

interface HeroVideoProps {
  onComplete: () => void;
}

const VIDEO_SRC = "/gridsense-hero.mp4";

export function HeroVideo({ onComplete }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleEnd = () => {
      setFadingOut(true);
      setTimeout(onComplete, 1200);
    };

    const handleError = () => {
      // If video fails, complete gracefully
      onComplete();
    };

    v.addEventListener("ended", handleEnd);
    v.addEventListener("error", handleError);

    // Fallback: max 20s
    const fallback = setTimeout(() => {
      if (!fadingOut) {
        setFadingOut(true);
        setTimeout(onComplete, 800);
      }
    }, 20000);

    return () => {
      v.removeEventListener("ended", handleEnd);
      v.removeEventListener("error", handleError);
      clearTimeout(fallback);
    };
  }, [onComplete, fadingOut]);

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(onComplete, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black ${
        fadingOut ? "animate-video-fade-out" : ""
      }`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
      />

      {/* Cinematic overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 px-4 py-2 text-xs font-medium tracking-widest uppercase text-white/70 hover:text-white border border-white/20 hover:border-white/50 rounded-md backdrop-blur-sm transition-all"
      >
        Skip Intro →
      </button>

      {/* Corner brand watermark */}
      <div className="absolute top-8 left-8 flex items-center gap-2 text-white/60 text-xs font-mono tracking-widest">
        <div className="w-1.5 h-1.5 rounded-full bg-gs-cyan-500 animate-pulse-dot" />
        GRIDSENSE · INITIALIZING
      </div>
    </div>
  );
}