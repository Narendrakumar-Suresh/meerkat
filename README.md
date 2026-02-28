# Meerkat

A fast, modern code editor built with Tauri, SvelteKit, and Monaco Editor.

![Meerkat Code Editor](meerkat.png)

## Features

- **Monaco Editor** - The same editor that powers VS Code
- **File Explorer** - Browse and manage your project files
- **Tab Management** - Multiple files open simultaneously with tab switching
- **Dark/Light Theme** - Toggle between themes with Ctrl+Shift+T
- **Keyboard Shortcuts** - Work faster with familiar shortcuts
- **Native Integration** - Built with Tauri for native performance

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save file |
| `Ctrl+O` | Open file |
| `Ctrl+N` | New file |
| `Ctrl+W` | Close tab |
| `Ctrl+B` | Toggle left sidebar |
| `Ctrl+R` | Toggle right sidebar |
| `Ctrl+Tab` | Switch tabs |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) (optional, npm works too)
- [Rust](https://rustup.rs/) (for Tauri)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Narendrakumar-Suresh/meerkat
cd meerkat
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

3. Run in development:
```bash
bun run tauri dev
# or
npm run tauri dev
```

### Build

Create a production build:

```bash
bun run tauri build
```

The executable will be generated in:
- Standalone: `src-tauri/target/release/meerkat.exe`
- Installer: `src-tauri/target/release/bundle/nsis/meerkat_0.1.0_x64-setup.exe`

Or use the pre-built release in the `release/` folder.

## Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Editor**: Monaco Editor
- **Backend**: Tauri (Rust)
- **Icons**: Lucide Svelte

## License

MIT
