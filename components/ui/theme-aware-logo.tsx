"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ThemeAwareLogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export function ThemeAwareLogo({
  width = 150,
  height = 150,
  className = "",
  alt = "Kenac Logo",
}: ThemeAwareLogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder or the default logo during SSR
    return (
      <Image
        src="/kenac_logo.png"
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  // Use resolvedTheme to get the actual theme (handles system preference)
  const currentTheme = resolvedTheme || theme;
  const logoSrc =
    currentTheme === "light" ? "/kenac_logo_light.png" : "/kenac_logo.png";

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
