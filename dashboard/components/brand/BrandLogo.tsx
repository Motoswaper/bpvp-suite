"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { BRAND_ASSETS } from "@/lib/brandAssets";

export type BrandLogoVariant = "login" | "sidebar" | "homeCard" | "compact";

const variantClass: Record<BrandLogoVariant, string> = {
  login:
    "h-auto max-h-52 w-full object-contain rounded-md border-0 bg-bpvp-page p-2 sm:max-h-56",
  sidebar: "h-14 w-full object-contain object-left sm:h-20",
  homeCard:
    "h-auto w-full max-w-[170px] rounded-md border-0 bg-bpvp-page p-1 object-contain [max-width:170px]",
  compact: "h-8 w-auto max-w-[140px] object-contain object-left"
};

/** Intrinsic logo ~640×1024; cap width so layout survives missing Tailwind (embedded browsers). */
const HOME_CARD_IMG_DIM = { width: 170, height: 272 } as const;

export function BrandLogo({
  variant,
  className,
  alt = "BPVP Suite logo"
}: {
  variant: BrandLogoVariant;
  className?: string;
  alt?: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const readTheme = () => {
      setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    };
    readTheme();
    const obs = new MutationObserver(readTheme);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const imgStyle =
    variant === "homeCard"
      ? ({ maxWidth: 170, width: "100%", height: "auto" } as const)
      : variant === "compact"
        ? ({ maxWidth: 140, height: "auto" } as const)
        : undefined;

  const imgDims = variant === "homeCard" ? HOME_CARD_IMG_DIM : undefined;

  return (
    <img
      src={theme === "dark" ? BRAND_ASSETS.logoDark : BRAND_ASSETS.logo}
      alt={alt}
      width={imgDims?.width}
      height={imgDims?.height}
      className={clsx(variantClass[variant], className)}
      style={imgStyle}
      loading={variant === "login" || variant === "homeCard" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
