# AGENTS.md - Agentic Coding Guidelines

> Guidelines for AI agents working in this repository

## Project Overview

LocaleKit is an AI-powered i18n translator desktop app built with Next.js, TypeScript, and Tauri (Rust). It translates JSON files to multiple languages using LLMs (OpenAI, Anthropic, Mistral, OpenRouter).

**Key Technologies**:

- Next.js 15 (App Router) + React 19 + TypeScript 5
- Tauri 2.x for desktop app wrapper
- Tailwind CSS 4 for styling
- Vercel AI SDK for LLM integration
- next-intl for internationalization
- TOON (Token-Oriented Object Notation) for efficient JSON translation

## Build & Development Commands

```bash
# Development
pnpm dev              # Next.js dev server
pnpm tauri:dev        # Run Tauri desktop app in dev mode

# Building
pnpm build            # Next.js production build
pnpm build:tauri      # Build for Tauri (static export)
pnpm tauri:build      # Build complete desktop app

# Linting & Formatting
pnpm lint             # ESLint (next/core-web-vitals)
pnpm format           # Prettier format all files
pnpm format:check     # Check formatting without fixing
```

**No test runner is configured.** Add tests using your preferred framework (Vitest/Jest) if needed.

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** - no implicit any, strict null checks
- Use explicit types for function parameters and return values
- Define interfaces for component props (e.g., `interface TooltipProps`)
- Use type aliases for unions/simple types
- Path aliases: `@/*` maps to root, `@/components/*` for components

### Formatting (Prettier)

- Semi-colons: **required**
- Quotes: **double quotes** (singleQuote: false)
- Tab width: **2 spaces**
- Trailing commas: **ES5 compatible** (es5)
- Print width: **80 characters**
- Arrow function parentheses: **always** (arrowParens: always)
- End of line: **LF**

### Naming Conventions

- **Components**: PascalCase (e.g., `Tooltip.tsx`, `SettingsModal.tsx`)
- **Functions/Variables**: camelCase (e.g., `handleTranslate`, `isTauri`)
- **Interfaces/Types**: PascalCase (e.g., `TranslationInput`, `ModelInfo`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **File names**: PascalCase for components, camelCase for utilities

### Imports

- React components: `import { useState } from "react"`
- Use path aliases: `import { isTauri } from "@/lib/utils"`
- Group imports: React/hooks first, then libraries, then local modules, then types
- Type imports: `import type { Metadata } from "next"`

### React Components

- Use functional components with default exports
- Props interface defined above component
- Client components: `"use client"` directive at top
- Prefer early returns over nested conditionals
- Use Tailwind classes for styling (no CSS modules)

### Error Handling

- Use try/catch for async operations
- Check error types: `err instanceof Error`
- Log errors to console with context: `console.error("[Translation] Failed:", err)`
- Provide user-friendly error messages in UI
- Handle edge cases explicitly (null checks, empty arrays)

### State Management

- Use React hooks (useState, useEffect, useRef)
- Local storage for persistence: `localStorage.getItem/setItem`
- Secure storage for API keys via Tauri

### Styling

- Tailwind CSS v4 with custom CSS variables
- Color scheme uses oklch() color space
- Dark mode: `.dark` class on html element
- Custom properties in globals.css (e.g., `--color-primary`)

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page (HomePage component)
│   └── globals.css        # Global styles with Tailwind
├── components/             # React components
│   ├── *.tsx              # Component files (PascalCase)
├── lib/                    # Utility libraries
│   ├── *.ts               # Utilities (camelCase)
│   ├── types.ts           # Shared TypeScript types
│   └── models.ts          # AI model definitions
├── i18n/                   # Internationalization config
│   └── request.ts         # next-intl request config
├── messages/               # Translation JSON files
│   └── *.json             # Locale files (en_gb.json, etc.)
├── src-tauri/              # Rust/Tauri backend
│   ├── src/               # Rust source code
│   └── Cargo.toml         # Rust dependencies
└── .github/workflows/      # CI/CD workflows
```

## Key Implementation Details

### TOON Format

The app converts JSON to TOON (Token-Oriented Object Notation) for LLM requests:

- More compact than JSON (reduces token usage ~20-30%)
- Functions: `jsonToToon()`, `toonToJson()` in `lib/toon.ts`
- Always send TOON to LLM, parse back to JSON

### Tauri Integration

- Check Tauri environment: `isTauri()` from `lib/utils`
- Invoke Rust commands: `invoke("command_name", { args })`
- Secure storage for API keys via Tauri plugin
- Handle window events (close, keyboard shortcuts)

### Translation Flow

1. Select JSON file → parse and display structure
2. User excludes paths they don't want translated
3. Select target languages and AI model
4. Convert JSON to TOON format
5. Send to LLM with system prompt
6. Parse response (handle TOON/JSON with fallbacks)
7. Merge translated content back to JSON structure
8. Auto-save to disk with language code in filename

### Chunking

Large files are automatically split:

- Threshold: ~4KB TOON content
- Functions in `lib/chunking.ts`
- Translate chunks sequentially, merge results

## Important Notes

- **No tests configured** - verify manually or add test framework
- **Prettier and ESLint must pass** before committing
- **Never commit API keys** - use secure storage or .env files
- **macOS development**: Uses aarch64 and x86_64 targets
- **Desktop only app** - not deployed as web app (Tauri desktop only)
