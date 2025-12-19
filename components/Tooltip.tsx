"use client";

import { useState } from "react";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  position?: "left" | "center" | "right";
}

export default function Tooltip({
  label,
  children,
  position = "center",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case "left":
        return {
          container: "top-full right-0 mt-2",
          arrow: "right-2 -translate-x-0",
        };
      case "right":
        return {
          container: "top-full left-0 mt-2",
          arrow: "left-2 -translate-x-0",
        };
      default: // center
        return {
          container: "top-full left-1/2 -translate-x-1/2 mt-2",
          arrow: "left-1/2 -translate-x-1/2",
        };
    }
  };

  const positionClasses = getPositionClasses();

  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`absolute ${positionClasses.container} z-10000`}>
          <div className="relative">
            <div
              className={`absolute -top-2 ${positionClasses.arrow} w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white`}
            />
            <div className="bg-white text-black text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
              {label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
