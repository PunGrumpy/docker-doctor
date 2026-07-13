import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { getScoreData } from "@/lib/score";

const parseScore = (raw: string | null): number => {
  const value = Math.trunc(Number(raw || "100"));
  return Math.min(100, Math.max(0, value));
};

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const score = parseScore(searchParams.get("s"));
  const { color } = getScoreData(score);

  const [regularFont, semiboldFont] = await Promise.all([
    readFile(path.join(process.cwd(), "app/share/og/geist-sans-regular.ttf")),
    readFile(path.join(process.cwd(), "app/share/og/geist-sans-semibold.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{ background: color }}
      tw="flex w-full h-full flex-col items-center justify-center"
    >
      <span
        style={{
          color: "#fff",
          letterSpacing: "-0.03em",
        }}
        tw="text-[256px] font-semibold"
      >
        {score}
      </span>
    </div>,
    {
      fonts: [
        {
          data: regularFont,
          name: "Geist",
          weight: 400,
        },
        {
          data: semiboldFont,
          name: "Geist",
          weight: 600,
        },
      ],
      height: 630,
      width: 1200,
    }
  );
};
