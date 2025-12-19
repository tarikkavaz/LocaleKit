# Changelog

All notable changes to LocaleKit will be documented in this file.

## [1.0.0] - 2024-12-XX

### Added

- Initial release of LocaleKit
- JSON file selection and parsing
- Visual JSON structure viewer with node exclusion
- Language selection with search and filtering
- AI-powered translation using multiple providers (OpenAI, Anthropic, Mistral, OpenRouter)
- Comprehensive OpenAI model support including GPT-5 series
- TOON (Token-Oriented Object Notation) format conversion for reduced API payload size and token usage
- Automatic chunking for large JSON files to prevent timeouts
- Chunk merging after translation to reconstruct complete files
- JSON structure alignment to preserve missing keys from original file
- Sequential translation with progress tracking
- Translation summary with warnings for failed or problematic translations
- Failed language retry mechanism (languages remain selected after failure)
- File saving with language code naming
- Overwrite confirmation dialog for existing files
- Settings modal with:
  - App language selection (change the application's own language)
  - Language management (add/edit/delete custom languages)
  - API key management with secure storage
  - Usage statistics tracking with cost estimation per provider
  - Usage period management (view stats for different time periods)
  - Theme toggle (light/dark)
- Usage tracking and statistics:
  - Token usage tracking (input/output/total)
  - Cost estimation per provider and model
  - Request success/failure tracking
  - Duration tracking for translation requests
- Console log viewer for debugging translation processes
- Error handling and retry logic for failed translations
- Token estimation for cost calculation
- Desktop app with Tauri (macOS, Windows, Linux)
- Code signing and notarization setup for macOS
- GPG signing for Linux packages
