import { Eye, Stethoscope } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/badge";
import { GitHub } from "@/components/icons/github";
import { Section } from "@/components/section";

export const ActionDemo = () => (
  <Section className="flex w-full flex-col items-center pt-8 pb-16">
    <h1 className="text-foreground flex flex-col items-center justify-center text-3xl font-normal tracking-tight sm:text-5xl">
      <span className="bg-muted relative top-[-0.08em] ml-1 inline-flex items-center gap-3 rounded-lg px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <GitHub aria-hidden="true" className="text-muted-foreground size-8" />
        every pull request
      </span>
      <Badge
        aria-hidden="true"
        className="-top-7 left-1/4 mb-7 -translate-x-1/4"
      >
        <span className="bg-card text-muted-foreground shadow-custom block rounded-lg px-1.5 py-1 font-mono text-xs tracking-normal whitespace-nowrap select-none">
          the action
        </span>
        <span className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="h-3 border-l border-dashed" />
          <span className="bg-border block shrink-0 rounded-full p-0.5">
            <span className="bg-background block size-[5px] shrink-0 rounded-full" />
          </span>
        </span>
      </Badge>
    </h1>

    <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-sm text-balance">
      Add <span className="font-mono">PunGrumpy/docker-doctor@v0</span> to your
      workflow and every pull request gets one sticky summary comment — advisory
      by default, gate when you trust it.
    </p>

    <div className="@container mt-8 w-full max-w-185">
      <div className="relative aspect-740/357 w-full">
        <div className="shadow-border absolute top-0 left-0 h-89.25 w-185 origin-top-left scale-[calc(tan(atan2(100cqw,740px)))] rounded-xl select-none">
          <div
            aria-hidden="true"
            className="to-border absolute top-0 left-25 h-9 w-0.5 bg-linear-to-b from-transparent"
          />
          <div
            aria-hidden="true"
            className="from-border absolute top-19.75 left-25 h-69.25 w-0.5 bg-linear-to-b from-85% to-transparent"
          />

          <div className="bg-card shadow-custom absolute top-9 left-7.5 flex size-10.75 items-center justify-center rounded-[10px]">
            <Stethoscope
              aria-hidden="true"
              className="text-muted-foreground size-5"
            />
          </div>
          <div className="bg-border absolute top-10.5 left-21.25 flex size-8 items-center justify-center rounded-full">
            <Eye aria-hidden="true" className="text-foreground size-4" />
          </div>

          <div className="absolute top-11.5 left-32.25 flex items-start gap-1.75">
            <div className="text-foreground text-base/[23.29px] font-medium">
              docker-doctor
            </div>
            <div className="bg-muted flex items-center rounded-full px-2.25">
              <div className="text-muted-foreground text-sm/[23.29px] font-medium">
                Bot
              </div>
            </div>
            <div className="text-muted-foreground text-base/[23.29px]">
              reviewed 2 days ago
            </div>
          </div>

          <div className="bg-background shadow-border absolute top-22.25 left-33.5 h-58.25 w-143.75 rounded-[11px]" />

          <div className="text-muted-foreground absolute top-24.75 left-37.75 text-sm/[23.29px] font-medium">
            Dockerfile
          </div>

          <div
            aria-hidden="true"
            className="bg-muted/40 absolute top-33.5 left-33.5 h-7.75 w-143.75"
          />
          <div
            aria-hidden="true"
            className="absolute top-41.25 left-33.5 h-7.75 w-143.75 bg-red-500/10"
          />
          <div
            aria-hidden="true"
            className="bg-muted/60 absolute top-33.5 left-33.5 h-7.75 w-15.25"
          />
          <div
            aria-hidden="true"
            className="absolute top-41.25 left-33.5 h-7.75 w-15.25 bg-red-500/15"
          />

          <div className="text-muted-foreground/60 absolute top-34.5 left-37.75 font-mono text-[13px]/[23.29px]">
            1
          </div>
          <div className="text-muted-foreground/60 absolute top-42.25 left-37.75 font-mono text-[13px]/[23.29px]">
            2
          </div>

          <div className="absolute top-34.5 left-54.5 font-mono text-[13px]/[23.29px]">
            <span className="text-[#d73a49] dark:text-[#f97583]">FROM</span>{" "}
            <span className="text-[#24292e] dark:text-[#e1e4e8]">
              node:latest
            </span>
          </div>
          <div className="absolute top-42.25 left-54.5 font-mono text-[13px]/[23.29px]">
            <span className="text-[#d73a49] dark:text-[#f97583]">ENV</span>{" "}
            <span className="text-[#24292e] dark:text-[#e1e4e8]">
              DB_PASSWORD=hunter2
            </span>
          </div>

          <div className="absolute top-53 left-38.5 flex items-center gap-1.75">
            <div className="text-sm/[23.29px] font-medium text-red-600 dark:text-red-400">
              Docker Doctor
            </div>
            <div className="bg-muted flex h-5.5 items-center rounded-[5px] px-2">
              <div className="text-foreground font-mono text-[13px]/[23.29px] font-medium">
                no-secrets-in-env
              </div>
            </div>
            <div className="text-sm/[23.29px] font-medium text-red-600 dark:text-red-400">
              (error)
            </div>
          </div>
          <div className="text-muted-foreground absolute top-60.25 left-38.5 w-lg text-sm/[23.29px]">
            Fix -&gt; use Docker Secrets or runtime environment variables
            instead of baking credentials into the image.
          </div>
          <Link
            className="text-foreground absolute top-72 left-38.5 text-sm/[23.29px] underline decoration-1 transition-opacity select-auto [text-underline-position:from-font] after:absolute after:-inset-x-6 after:-inset-y-5 hover:opacity-70"
            href="/docs/reference/rules"
          >
            See docs
          </Link>
        </div>
      </div>
    </div>
  </Section>
);
