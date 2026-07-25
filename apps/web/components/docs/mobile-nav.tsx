"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { DocsSidebar } from "@/components/docs/sidebar";
import { Logo } from "@/components/logo";
import { ChangelogButton } from "@/components/nav-buttons";

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
        className="-ms-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground lg:hidden"
        onClick={openMenu}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <dialog
        aria-label="Documentation"
        className="fixed inset-y-0 left-0 z-50 m-0 h-dvh max-h-dvh w-[min(19rem,85vw)] max-w-none -translate-x-full border-dashed border-e bg-background text-foreground transition-[transform,overlay,display] transition-discrete duration-200 ease-[var(--ease-out)] backdrop:bg-black/40 open:translate-x-0 starting:open:-translate-x-full"
        id="docs-mobile-menu"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        ref={dialogRef}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-dashed border-b px-4">
            <Link
              className="flex items-center gap-1.5 font-medium"
              href="/docs"
            >
              <Logo aria-hidden="true" className="size-4" />
              Docker Doctor
            </Link>
            <button
              aria-label="Close menu"
              className="-me-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={closeMenu}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
            <DocsSidebar tree={tree} />
          </div>
          <div className="border-dashed border-t p-4">
            <ChangelogButton />
          </div>
        </div>
      </dialog>
    </>
  );
};
