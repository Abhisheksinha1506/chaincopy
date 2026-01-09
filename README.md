# ClipChain (ChainCopy)

ClipChain is an intelligent, developer-focused clipboard manager built with **Tauri v2**, **React**, and **TypeScript**. It introduces the concept of "Chains"—grouping related clipboard copies together automatically to keep your workflow organized.

Unlike traditional clipboard managers that just list history linearly, ClipChain monitors your activity and intelligently groups consecutive copies into a single context, making it perfect for developers copying multiple snippets of code or researchers gathering data from a single source.

## 🚀 Key Features

*   **🔗 Smart Chaining**: Automatically groups consecutive copies into "Chains".
*   **💻 Code Intelligence**: Auto-detects code snippets vs. plain text and applies syntax highlighting.
*   **🔄 Smart Internal Pasting**: Copy an entire chain as one block, but if you paste it back into ClipChain, it intelligently restores the individual items.
*   **🔍 Full-Text Search**: Instant search across all your clipboard history using FlexSearch.
*   **💾 Local Persistence**:
    *   **Desktop**: Uses a persistent SQLite database stored locally (`sql.js`).
    *   **Web Fallback**: Gracefully degrades to `localStorage` when running in a browser.
*   **🎨 Modern UI**: Clean, dark-mode first interface built with Tailwind CSS v4.

## 🛠 Tech Stack

*   **Core**: [Tauri v2](https://v2.tauri.app/) (Rust)
*   **Frontend**: React 19, TypeScript
*   **Build Tool**: Vite 7
*   **Styling**: Tailwind CSS v4, Lucide React (Icons)
*   **State Management**: Zustand
*   **Database**: SQL.js (WASM SQLite)
*   **Search**: FlexSearch
*   **Clipboard Monitor**: `arboard` (Rust crate)

## 📦 Prerequisites

Before you start, ensure you have the following installed:

*   **Node.js** (v18 or newer)
*   **Rust** (Stable) - [Install Rust](https://www.rust-lang.org/tools/install)
*   **Tauri CLI Prerequisites** (OS-specific dependencies like XCode Command Line Tools or build-essential)

## 🏃‍♂️ Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/clipchain.git
    cd clipchain
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run in Development Mode**
    This will start the frontend server and the Tauri application window.
    ```bash
    npm run tauri dev
    ```
    *   *Note: If you just want to run the web frontend (without system clipboard access), you can run `npm run dev`.*

## 🏗 Building for Production

To create a standalone application executable or installer:

```bash
npm run tauri build
```

The artifacts will be generated in `src-tauri/target/release/bundle/`.

## 📂 Project Structure

*   `src/` - React Frontend
    *   `components/` - UI Components (Workspace, CodeBlock, etc.)
    *   `hooks/` - Custom hooks (State management via `useStore`)
    *   `utils/` - Logic for Chain management and Database persistence
*   `src-tauri/` - Rust Backend
    *   `src/lib.rs` - Main entry point; handles clipboard polling thread.
    *   `capabilities/` - Tauri permission configurations.

## 🔒 Privacy & Data

ClipChain is **local-first**.
*   All clipboard data is stored locally on your machine (specifically in your OS's AppData directory).
*   No data is ever sent to the cloud or external servers.
