# Telegram TUI (TG-TUI)

A modern Telegram Terminal User Interface (TUI) for power users. Built with React (Ink) and MTProto (GramJS).

## Features
- **Secure Login:** QR code authentication with DC migration support.
- **Hierarchical Navigation:** Seamlessly switch between Chat List, Forum Topics, and Conversations.
- **Advanced Search:** Type-to-Find filtering in real-time.
- **Infinite Scrolling:** Automatically load and view your entire message history.
- **Multipane Layout:** Fixed sidebar and main area (tmux-style) for a clean terminal look.
- **Safe Navigation:** Hierarchical `Esc` logic and exit confirmation.

## Prerequisites
- **Node.js**: Version 22 or higher.
- **API Credentials**: Get your `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org).

## Installation

1. **Clone the Repo:**
   ```bash
   git clone https://github.com/RyanisyydsTT/telegram-tui
   cd telegram-tui
   ```

2. **Configure Environment:**
   Copy the example `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   # Edit .env and add your API_ID and API_HASH
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

## Development
Run the app in development mode with `tsx`:
```bash
npm start
```

## Shortcuts
- **Tab**: Switch focus between Sidebar (Chats/Topics) and Main Chat (Message History).
- **`/` (in Sidebar)**: Enter Search mode to filter your contacts.
- **`Esc`**:
  - Clear search (if searching).
  - Go back to Chats (if in Topics).
  - Switch to Sidebar (if in Chat).
  - Confirm Exit (if in Sidebar).
- **`PageUp / PageDown`**: Scroll through message history (Fast).
- **`Shift + Up / Down`**: Scroll through message history (Fine).
- **`Ctrl + L`**: Logout and clear all local session data.

---

## Building Binaries (Multi-Platform)

You can build standalone binaries for different operating systems using `pkg`.

### 1. Build for All Platforms
```bash
npm run build:exe
```
This will generate binaries in the `bin/` directory.

### 2. Targeted Builds
- **macOS (x64):** `npm run build:macos` -> `bin/macos/tg-tui`
- **Linux (x64):** `npm run build:linux` -> `bin/linux/tg-tui`
- **Windows (x64):** `npm run build:win` -> `bin/win/tg-tui.exe`

### 3. Moving the Binary
Once built, move the binary to your global path (e.g., `/usr/local/bin` on macOS/Linux) to run it from anywhere:
```bash
mv bin/macos/tg-tui /usr/local/bin/tg-tui
```

---

## Technical Details
- **UI Framework**: [Ink](https://github.com/vadimdemedes/ink) (React in the terminal).
- **Telegram Protocol**: [GramJS](https://gram.js.org/).
- **Binary Packaging**: [pkg](https://github.com/vercel/pkg).

## License
MIT
