"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [positionUp, setPositionUp] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    if (selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 200;
      
      const shouldPositionUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      setPositionUp(shouldPositionUp);
      
      setPosition({
        top: shouldPositionUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        backgroundColor: "#000000",
        maxHeight: "200px",
        overflowY: "auto",
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
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
  );

  return (
    <>
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
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  );
}
