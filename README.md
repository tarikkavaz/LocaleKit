# LocaleKit

AI-powered i18n translator for JSON files. Translate your JSON files into multiple languages using advanced AI models.

## Features

- **Visual JSON Structure Viewer**: Selectively exclude nodes from translation
- **Multi-Language Support**: Translate to 40+ languages with custom language support
- **AI-Powered Translation**: Uses OpenAI, Anthropic, Mistral, and OpenRouter models
- **Comprehensive Model Support**: Supports all OpenAI models including GPT-5 series
- **Secure API Key Storage**: OS-level secure storage for API keys
- **Progress Tracking**: Real-time progress indicators during translation
- **File Management**: Automatic file naming with language codes and overwrite protection

## Installation

Download the latest release from [GitHub Releases](https://github.com/yourusername/LocaleKit/releases) and install:

- **macOS**: Download the `.dmg` file, open it, and drag LocaleKit to Applications
- **Windows**: Download the `.msi` installer and run it
- **Linux**: Download the `.AppImage` or `.deb` package for your distribution

## Usage

1. Select a source JSON file
2. Choose an AI model
3. Review and exclude nodes you don't want translated
4. Select target languages
5. Click Translate
6. FIles are saved to the location of the source file

## Settings

Configure API keys and manage languages in Settings:

- **Languages Tab**: Add, edit, or delete custom languages
- **API Keys Tab**: Manage API keys for different providers



![screenshot-01](/Users/tarik/Work/Other/LocaleKit/screenshot-01.png)

![screenshot-02](/Users/tarik/Work/Other/LocaleKit/screenshot-02.png)

![screenshot-03](/Users/tarik/Work/Other/LocaleKit/screenshot-03.png)

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Rust (for Tauri)

### Building from Source

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tauri:dev

# Build for production
pnpm tauri:build
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Support

- **Issues**: [GitHub Issues](https://github.com/tarikkavaz/LocaleKit/issues)
- **Releases**: [GitHub Releases](https://github.com/tarikkavaz/LocaleKit/releases)
