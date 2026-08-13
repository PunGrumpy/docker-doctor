import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { source, getPageImageUrl } from "@/lib/source";

export const generateStaticParams = () =>
  source.getPages().map((page) => ({
    slug: getPageImageUrl(page).segments,
  }));

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) => {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));

  if (!page) {
    return new Response("Not found", { status: 404 });
  }

  const { title, description } = page.data;

  const [regularFont, semiboldFont, backgroundImage] = await Promise.all([
    readFile(
      path.join(process.cwd(), "app/og/docs/[...slug]/geist-sans-regular.ttf")
    ),
    readFile(
      path.join(process.cwd(), "app/og/docs/[...slug]/geist-sans-semibold.ttf")
    ),
    readFile(path.join(process.cwd(), "app/og/docs/[...slug]/background.png")),
  ]);

  const backgroundImageData = backgroundImage.buffer.slice(
    backgroundImage.byteOffset,
    backgroundImage.byteOffset + backgroundImage.byteLength
  );

  return new ImageResponse(
    <div style={{ fontFamily: "Geist" }} tw="flex h-full w-full bg-black">
      {/* oxlint-disable-next-line next/no-img-element */}
      <img
        alt="Docker Doctor OpenGraph Background"
        height={630}
        src={backgroundImageData as never}
        width={1200}
      />
      {/* background.png draws a dotted baseline grid; pt-[240px] top-anchors
          the block so the title's first line always lands on it, whatever
          the description wraps to. */}
      <div tw="flex flex-col absolute h-full w-full justify-start left-[91px] pr-[50px] pt-[240px] pb-[86px]">
        <div
          style={{
            textWrap: "balance",
          }}
          tw="text-[84px] font-medium text-white tracking-tight flex leading-[1.1] mb-4"
        >
          {title}
        </div>
        <div
          style={{
            color: "#8B8B8B",
            lineHeight: "44px",
            textWrap: "balance",
          }}
          tw="text-[28px]"
        >
          {description}
        </div>
      </div>
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
          weight: 500,
        },
      ],
      height: 630,
      width: 1200,
    }
  );
};
