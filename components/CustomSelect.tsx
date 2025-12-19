"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none cursor-pointer transition-colors flex items-center justify-between"
        style={{
          backgroundColor: "#000000",
          color: "#ffffff",
        }}
      >
        <span>{selectedOption?.label || placeholder || "Select..."}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          style={{ color: "#ffffff" }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 border border-border rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: "#000000",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-900 transition-colors ${
                  isSelected ? "bg-primary/60" : ""
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : "#000000",
                  color: "#ffffff",
                }}
              >
                {isSelected && (
                  <Check
                    className="w-4 h-4 shrink-0"
                    style={{ color: "#ffffff" }}
                  />
                )}
                <span className={isSelected ? "font-medium" : ""}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
