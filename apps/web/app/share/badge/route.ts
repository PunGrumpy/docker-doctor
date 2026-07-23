import { parseScoreQuery } from "@/lib/score";

const LABEL = "Docker Doctor";

const getScoreColor = (score: number): string => {
  if (score >= 90) {
    return "#4c1";
  }
  if (score >= 75) {
    return "#dfb317";
  }
  return "#e05d44";
};

export const GET = (req: Request): Response => {
  const { searchParams } = new URL(req.url);
  const score = parseScoreQuery(searchParams.get("s"), 100);

  const labelWidth = 108;
  const valueWidth = 76;
  const totalWidth = labelWidth + valueWidth;
  const height = 20;
  const borderRadius = 3;

  const valueColor = getScoreColor(score);
  const labelColor = "#555";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
  <defs>
    <linearGradient id="shine" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".07" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <clipPath id="round">
      <rect width="${totalWidth}" height="${height}" rx="${borderRadius}" />
    </clipPath>
  </defs>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="${height}" fill="${labelColor}" />
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${valueColor}" />
    <rect width="${totalWidth}" height="${height}" fill="url(#shine)" />
  </g>
  <g fill="#fff" font-family="DejaVu Sans, Verdana, Geneva, sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14" text-anchor="middle">${LABEL}</text>
    <text
      x="${labelWidth + valueWidth / 2}"
      y="14"
      text-anchor="middle"
      style="font-variant-numeric: tabular-nums"
    >
      ${score}/100
    </text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "image/svg+xml",
    },
  });
};
