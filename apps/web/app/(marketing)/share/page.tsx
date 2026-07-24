import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Section } from "@/components/section";
import { Card } from "@/components/sections/share/card";
import { Hero } from "@/components/sections/share/hero";
import { getScoreData } from "@/lib/score";
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
  const scoreVal = Math.min(
    100,
    Math.max(0, Math.trunc(Number(params.s || "100")))
  );
  const { label } = getScoreData(scoreVal);
  const warnings = Math.trunc(Number(params.w || "0"));
  const errors = Math.trunc(Number(params.e || "0"));

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
  const score = Math.min(
    100,
    Math.max(0, Math.trunc(Number(params.s || "100")))
  );
  const warnings = Math.max(0, Math.trunc(Number(params.w || "0")));
  const errors = Math.max(0, Math.trunc(Number(params.e || "0")));

  return (
    <>
      <Hero />
      <Section className="pt-8 pb-16 items-stretch">
        <Card score={score} errors={errors} warnings={warnings} />
      </Section>
    </>
  );
};

export default SharePage;
