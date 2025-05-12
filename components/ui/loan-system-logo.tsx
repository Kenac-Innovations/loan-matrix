import type { SVGProps } from "react";

export function LoanSystemLogo(props: SVGProps<SVGSVGElement>) {
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
