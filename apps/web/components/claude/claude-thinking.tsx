"use client";

import { useState, useEffect } from "react";

/**
 * ClaudeThinking — Claude Code's "working" line.
 *
 * A pulsing sparkle glyph, a whimsical verb, and a live elapsed / interrupt
 * hint. The verb carries Claude's understated shimmer: a lighter highlight
 * drifts across the terracotta word like a gradient wave (done with
 * background-clip: text so the DOM text stays selectable and announced). The
 * whole line is a polite live region for screen readers.
 */
// Captured cycle from claude/thinking frames: · ✢ ✳ ✶ ✻ ✽ ✻ ✶ ✳ ✢
const GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const VERBS = [
  "Thinking",
  "Levitating",
  "Schlepping",
  "Herding",
  "Percolating",
  "Noodling",
  "Conjuring",
];

// terracotta base
const CLAUDE = "#cd694a";
// the highlight the wave carries
const HILITE = "#e79475";
const DIM = "#7d7d7d";

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
};

export const ClaudeThinking = ({
  running = true,
  verbs = VERBS,
  showTokens = true,
  className,
}: {
  running?: boolean;
  verbs?: string[];
  showTokens?: boolean;
  className?: string;
}) => {
  const prefersReduced = usePrefersReducedMotion();
  const [glyph, setGlyph] = useState(0);
  const [verbIdx, setVerbIdx] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!running || prefersReduced) {
      return;
    }
    const id = setInterval(() => setGlyph((g) => (g + 1) % GLYPHS.length), 110);
    return () => clearInterval(id);
  }, [running, prefersReduced]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) {
      return;
    }
    // Verbs change slowly, like the real thing — not every second.
    const id = setInterval(
      () => setVerbIdx((v) => (v + 1) % verbs.length),
      5200
    );
    return () => clearInterval(id);
  }, [running, verbs.length]);

  if (!running) {
    return null;
  }

  const verb = verbs[verbIdx % verbs.length];
  const tokens = showTokens ? ` · ↑ ${Math.max(0, secs * 137)} tokens` : "";

  return (
    <output
      aria-live="polite"
      className={className}
      style={{
        alignItems: "center",
        display: "flex",
        fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
        fontSize: 13,
        gap: 8,
      }}
    >
      <style>{`
        .cw-verb {
          background-image: linear-gradient(100deg, ${CLAUDE} 43%, ${HILITE} 50%, ${CLAUDE} 57%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: cw-shine 2.8s linear infinite;
        }
        @keyframes cw-shine {
          from { background-position: 100% 0; }
          to   { background-position: -100% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cw-verb {
            animation: none;
            background-image: none;
            color: ${CLAUDE};
            -webkit-text-fill-color: ${CLAUDE};
          }
        }
      `}</style>
      <span
        aria-hidden
        style={{ color: CLAUDE, display: "inline-block", width: "1ch" }}
      >
        {prefersReduced ? "✳" : GLYPHS[glyph]}
      </span>
      <span className="cw-verb">{verb}…</span>
      <span style={{ color: DIM }}>
        ({secs}s{tokens} · esc to interrupt)
      </span>
    </output>
  );
};
