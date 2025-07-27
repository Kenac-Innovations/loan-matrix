"use client";

import type { SVGProps } from "react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function LoanSystemLogo(props: SVGProps<SVGSVGElement>) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return default during SSR
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 60"
        width="200"
        height="60"
        {...props}
      >
        <path
          d="M20 10h10v40H20zM35 10h10v40H35zM50 10h10v40H50zM65 10h10v40H65z"
          fill="#2a9fff"
        />
        <text
          x="100"
          y="38"
          fontFamily="Arial"
          fontSize="24"
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
        >
          KENAC
        </text>
      </svg>
    );
  }

  const currentTheme = resolvedTheme || theme;
  const textFill = currentTheme === "light" ? "#000000" : "#ffffff";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 60"
      width="200"
      height="60"
      {...props}
    >
      <path
        d="M20 10h10v40H20zM35 10h10v40H35zM50 10h10v40H50zM65 10h10v40H65z"
        fill="#2a9fff"
      />
      <text
        x="100"
        y="38"
        fontFamily="Arial"
        fontSize="24"
        fontWeight="bold"
        fill={textFill}
        textAnchor="middle"
      >
        KENAC
      </text>
    </svg>
  );
}
