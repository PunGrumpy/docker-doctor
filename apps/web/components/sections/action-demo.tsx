import { Eye, Stethoscope } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/badge";
import { GitHub } from "@/components/icons/github";
import { Section } from "@/components/section";

export const ActionDemo = () => (
  <Section className="pt-8 pb-16 flex flex-col items-center w-full">
    <h1 className="flex flex-col items-center justify-center text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
      <span className="relative top-[-0.08em] ml-1 inline-flex items-center gap-3 rounded-lg bg-muted px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <GitHub aria-hidden="true" className="size-8 text-muted-foreground" />
        every pull request
      </span>
      <Badge
        aria-hidden="true"
        className="-top-7 left-1/4 -translate-x-1/4 mb-7"
      >
        <span className="block px-1.5 py-1 font-mono text-xs select-none whitespace-nowrap rounded-lg bg-card text-muted-foreground tracking-normal shadow-custom">
          the action
        </span>
        <span className="absolute flex items-center top-full left-1/2 -translate-x-1/2 flex-col">
          <span className="border-dashed h-3 border-l" />
          <span className="block shrink-0 rounded-full bg-border p-0.5">
            <span className="block size-[5px] shrink-0 rounded-full bg-background" />
          </span>
        </span>
      </Badge>
    </h1>

    <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-sm text-muted-foreground">
      Add <span className="font-mono">PunGrumpy/docker-doctor@v0</span> to your
      workflow and every pull request gets one sticky summary comment — advisory
      by default, gate when you trust it.
    </p>

    <div className="mt-8 w-full max-w-185 @container">
      <div className="relative w-full aspect-740/357">
        <div className="absolute top-0 left-0 w-185 h-89.25 origin-top-left scale-[calc(tan(atan2(100cqw,740px)))] rounded-xl shadow-border select-none">
          <div
            aria-hidden="true"
            className="absolute left-25 top-0 w-0.5 h-9 bg-linear-to-b from-transparent to-border"
          />
          <div
            aria-hidden="true"
            className="absolute left-25 top-19.75 w-0.5 h-69.25 bg-linear-to-b from-border from-85% to-transparent"
          />

          <div className="absolute left-7.5 top-9 flex size-10.75 items-center justify-center rounded-[10px] bg-card shadow-custom">
            <Stethoscope
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </div>
          <div className="absolute left-21.25 top-10.5 flex size-8 items-center justify-center rounded-full bg-border">
            <Eye aria-hidden="true" className="size-4 text-foreground" />
          </div>

          <div className="absolute left-32.25 top-11.5 flex items-start gap-1.75">
            <div className="font-medium text-foreground text-base/[23.29px]">
              docker-doctor
            </div>
            <div className="flex items-center px-2.25 rounded-full bg-muted">
              <div className="font-medium text-muted-foreground text-sm/[23.29px]">
                Bot
              </div>
            </div>
            <div className="text-muted-foreground text-base/[23.29px]">
              reviewed 2 days ago
            </div>
          </div>

          <div className="absolute left-33.5 top-22.25 w-143.75 h-58.25 rounded-[11px] bg-background shadow-border" />

          <div className="absolute left-37.75 top-24.75 font-medium text-muted-foreground text-sm/[23.29px]">
            Dockerfile
          </div>

          <div
            aria-hidden="true"
            className="absolute left-33.5 top-33.5 w-143.75 h-7.75 bg-muted/40"
          />
          <div
            aria-hidden="true"
            className="absolute left-33.5 top-41.25 w-143.75 h-7.75 bg-red-500/10"
          />
          <div
            aria-hidden="true"
            className="absolute left-33.5 top-33.5 w-15.25 h-7.75 bg-muted/60"
          />
          <div
            aria-hidden="true"
            className="absolute left-33.5 top-41.25 w-15.25 h-7.75 bg-red-500/15"
          />

          <div className="absolute left-37.75 top-34.5 font-mono text-muted-foreground/60 text-[13px]/[23.29px]">
            1
          </div>
          <div className="absolute left-37.75 top-42.25 font-mono text-muted-foreground/60 text-[13px]/[23.29px]">
            2
          </div>

          <div className="absolute left-54.5 top-34.5 font-mono text-[13px]/[23.29px]">
            <span className="text-[#d73a49] dark:text-[#f97583]">FROM</span>{" "}
            <span className="text-[#24292e] dark:text-[#e1e4e8]">
              node:latest
            </span>
          </div>
          <div className="absolute left-54.5 top-42.25 font-mono text-[13px]/[23.29px]">
            <span className="text-[#d73a49] dark:text-[#f97583]">ENV</span>{" "}
            <span className="text-[#24292e] dark:text-[#e1e4e8]">
              DB_PASSWORD=hunter2
            </span>
          </div>

          <div className="absolute left-38.5 top-53 flex items-center gap-1.75">
            <div className="font-medium text-red-600 dark:text-red-400 text-sm/[23.29px]">
              Docker Doctor
            </div>
            <div className="flex h-5.5 items-center rounded-[5px] bg-muted px-2">
              <div className="font-mono font-medium text-foreground text-[13px]/[23.29px]">
                no-secrets-in-env
              </div>
            </div>
            <div className="font-medium text-red-600 dark:text-red-400 text-sm/[23.29px]">
              (error)
            </div>
          </div>
          <div className="absolute left-38.5 top-60.25 w-lg text-muted-foreground text-sm/[23.29px]">
            Fix -&gt; use Docker Secrets or runtime environment variables
            instead of baking credentials into the image.
          </div>
          <Link
            className="absolute left-38.5 top-72 select-auto text-foreground text-sm/[23.29px] underline decoration-1 [text-underline-position:from-font] transition-opacity hover:opacity-70 after:absolute after:-inset-x-6 after:-inset-y-5"
            href="/docs/reference/rules"
          >
            See docs
          </Link>
        </div>
      </div>
    </div>
  </Section>
);
