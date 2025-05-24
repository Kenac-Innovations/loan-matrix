import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function useThemeColors() {
  const { theme } = useTheme();
  const [colors, setColors] = useState({
    textColor: "text-gray-900",
    textColorMuted: "text-gray-500",
    borderColor: "gray-200",
    cardBg: "bg-white",
    inputBg: "bg-white",
    dropdownBg: "bg-white",
    hoverBgColor: "gray-100",
    tabsBg: "bg-gray-100",
    tabsText: "text-gray-700",
  });

  useEffect(() => {
    if (theme === "dark") {
      setColors({
        textColor: "text-gray-100",
        textColorMuted: "text-gray-400",
        borderColor: "gray-800",
        cardBg: "bg-[#0a0e17]",
        inputBg: "bg-[#0a0e17]",
        dropdownBg: "bg-[#0a0e17]",
        hoverBgColor: "gray-800",
        tabsBg: "bg-gray-800",
        tabsText: "text-gray-300",
      });
    } else {
      setColors({
        textColor: "text-gray-900",
        textColorMuted: "text-gray-500",
        borderColor: "gray-200",
        cardBg: "bg-white",
        inputBg: "bg-white",
        dropdownBg: "bg-white",
        hoverBgColor: "gray-100",
        tabsBg: "bg-gray-100",
        tabsText: "text-gray-700",
      });
    }
  }, [theme]);

  return colors;
}
