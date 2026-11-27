"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { coverThen } from "../PageCurtain";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** A next/link that plays the page curtain before it navigates. New-tab
 * clicks, modified clicks and links to the page you are on behave like a
 * plain link. */
export function TransitionLink({ href, onClick, ...rest }: Props) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (new URL(href, location.href).pathname === location.pathname) return;
    e.preventDefault();
    coverThen(() => router.push(href));
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}
