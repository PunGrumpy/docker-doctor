"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { DocsSidebar } from "@/components/docs/sidebar";
import { Logo } from "@/components/logo";
import { ChangelogButton, LeaderboardButton } from "@/components/nav-buttons";

interface DocsMobileNavProps {
  readonly tree: PageTreeRoot;
}

export const DocsMobileNav = ({ tree }: DocsMobileNavProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Close the drawer once navigation lands on the next page.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // Close when the backdrop (the dialog element itself, outside the panel) is
  // clicked. Attached natively so it stays off a non-interactive JSX handler.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        dialog.close();
      }
    };

    dialog.addEventListener("click", onBackdropClick);
    return () => {
      dialog.removeEventListener("click", onBackdropClick);
      document.body.style.overflow = "";
    };
  }, []);

  const openMenu = () => {
    dialogRef.current?.showModal();
    document.body.style.overflow = "hidden";
  };

  const closeMenu = () => dialogRef.current?.close();

  return (
    <>
      <button
        aria-controls="docs-mobile-menu"
        aria-haspopup="dialog"
        aria-label="Open documentation menu"
        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground relative -me-1 flex size-9 items-center justify-center rounded-lg transition-transform duration-150 after:absolute after:-inset-1 after:content-[''] active:scale-[0.96] lg:hidden"
        onClick={openMenu}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <dialog
        aria-label="Documentation"
        className="bg-background text-foreground fixed inset-y-0 start-auto end-0 z-50 m-0 h-dvh max-h-dvh w-[min(19rem,85vw)] max-w-none border-s border-dashed transition-[transform,overlay,display] transition-discrete duration-350 ease-[var(--ease-drawer)] backdrop:bg-black/40 backdrop:opacity-0 backdrop:transition-[opacity,overlay,display] backdrop:transition-discrete backdrop:duration-350 backdrop:ease-[var(--ease-drawer)] open:translate-x-0 open:backdrop:opacity-100 motion-reduce:transition-none motion-reduce:backdrop:transition-none ltr:translate-x-full rtl:-translate-x-full starting:open:backdrop:opacity-0 starting:open:ltr:translate-x-full starting:open:rtl:-translate-x-full"
        id="docs-mobile-menu"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        ref={dialogRef}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-dashed px-4">
            <Link
              className="flex items-center gap-1.5 font-medium"
              href="/docs"
            >
              <Logo aria-hidden="true" className="size-4" />
              Docker Doctor
            </Link>
            <button
              aria-label="Close menu"
              className="text-muted-foreground hover:bg-muted/50 hover:text-foreground relative -me-1 flex size-9 items-center justify-center rounded-lg transition-transform duration-150 after:absolute after:-inset-1 after:content-[''] active:scale-[0.96]"
              onClick={closeMenu}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
            <DocsSidebar tree={tree} />
          </div>
          <div className="flex gap-2 border-t border-dashed p-4 pe-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <LeaderboardButton />
            <ChangelogButton />
          </div>
        </div>
      </dialog>
    </>
  );
};
