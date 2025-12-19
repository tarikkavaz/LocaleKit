"use client";

import { Settings, Info, X, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/useTheme";
import { isTauri } from "@/lib/utils";

interface DraggableHeaderProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
  onQuitClick: () => void;
  onReloadClick: () => void;
}

export default function DraggableHeader({
  onSettingsClick,
  onAboutClick,
  onQuitClick,
  onReloadClick,
}: DraggableHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isTauriApp, setIsTauriApp] = useState(false);

  useEffect(() => {
    setIsTauriApp(isTauri());
  }, []);

  const Tooltip = ({ label, children }: { label: string; children: React.ReactNode }) => {
    const [visible, setVisible] = useState(false);
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
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-10000">
            <div className="relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white" />
              <div className="bg-white text-black text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
                {label}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-4 bg-background/80 backdrop-blur-md z-9999 transition-colors"
    >
      <div data-tauri-drag-region className="flex-1" />
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2 select-none cursor-default"
      >
        <div data-tauri-drag-region>
          <h1 data-tauri-drag-region className="text-xl font-bold text-foreground">
            LocaleKit
          </h1>
          <p data-tauri-drag-region className="text-xs text-foreground/60">
            AI-powered i18n translator
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip label="Reload and clear cache">
          <button
            data-tauri-drag-region="false"
            type="button"
            onClick={onReloadClick}
            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer"
            aria-label="Reload"
          >
            <RefreshCw className="w-5 h-5 text-foreground hover:text-foreground/90 transition-colors" />
          </button>
        </Tooltip>
        <Tooltip label="Settings">
          <button
            data-tauri-drag-region="false"
            type="button"
            onClick={onSettingsClick}
            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-foreground hover:text-foreground/90 transition-colors" />
          </button>
        </Tooltip>

        {isTauriApp && (
          <div className="relative flex flex-col items-center group pr-6" ref={menuRef}>
            <Tooltip label="About / Quit">
              <button
                data-tauri-drag-region="false"
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer"
                aria-label="Menu"
              >
                <Info className="w-5 h-5 text-foreground hover:text-foreground/90 transition-colors" />
              </button>
            </Tooltip>

            {isMenuOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-48 bg-card-bg border border-border rounded-lg shadow-lg z-50"
                style={{ backgroundColor: "var(--card-bg-solid)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onAboutClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-foreground/5 transition-colors first:rounded-t-lg"
                >
                  <Info className="w-4 h-4" />
                  <span>About</span>
                </button>

                <div className="border-t border-border" />

                <button
                  type="button"
                  onClick={() => {
                    onQuitClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error-text hover:bg-error-bg transition-colors last:rounded-b-lg"
                >
                  <X className="w-4 h-4" />
                  <span>Quit</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
