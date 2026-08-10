import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Section } from "@/components/section";
import { Card } from "@/components/sections/share/card";
import { Hero } from "@/components/sections/share/hero";
import { getScoreData, parseCountQuery, parseScoreQuery } from "@/lib/score";
import { url as baseUrl } from "@/lib/url";

interface SearchParams {
  readonly s?: string;
  readonly w?: string;
  readonly e?: string;
}

interface SharePageProps {
  readonly searchParams: Promise<SearchParams>;
}

export const generateMetadata = async ({
  searchParams,
}: SharePageProps): Promise<Metadata> => {
  const params = await searchParams;
  const scoreVal = parseScoreQuery(params.s ?? null);
  const { label } = getScoreData(scoreVal);
  const warnings = parseCountQuery(params.w ?? null);
  const errors = parseCountQuery(params.e ?? null);

  const title = `Docker Doctor Score: ${scoreVal}/100 (${label})`;
  const description = `This project scored ${scoreVal}/100 on Docker Doctor static analysis. Issues found: ${errors} errors, ${warnings} warnings.`;
  const ogImage = `${baseUrl}/share/og?s=${scoreVal}&e=${errors}&w=${warnings}`;

  return {
    description,
    openGraph: {
      description,
      images: [{ height: 630, url: ogImage, width: 1200 }],
      title,
      type: "website",
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [ogImage],
      title,
    },
  };
};

const SharePage = async ({
  searchParams,
}: SharePageProps): Promise<ReactNode> => {
  const params = await searchParams;
  const score = parseScoreQuery(params.s ?? null);
  const warnings = parseCountQuery(params.w ?? null);
  const errors = parseCountQuery(params.e ?? null);

  return (
    <>
      <Hero />
      <Section className="items-stretch pt-8 pb-16">
        <Card score={score} errors={errors} warnings={warnings} />
      </Section>
    </>
  );
};

export default SharePage;
