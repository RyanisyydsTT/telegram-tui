# Telegram TUI Plan

## Goal
Create a functional and visually appealing Telegram TUI with QR code login using `gramjs` and `ink`.

## Technology Stack
- **Node.js**: Runtime
- **gramjs**: Telegram MTProto client
- **ink**: React-based TUI framework
- **asharahmed/qr-cli**: QR code generation
- **TypeScript**: For type safety

## Architecture
1. **Telegram Logic (`src/telegram.ts`)**: Handles the `gramjs` client, authentication flow, and message fetching.
2. **TUI Logic**:
   - `index.tsx`: Main entry point and layout for the TUI.
3. **Telegram Manager**:
   - `telegram.ts`: Handles MTProto connection and session management.

## Steps
1. **Setup Project**: Done.
2. **Implement Telegram Client**: Done with DC migration support.
3. **Implement UI**: Done with locked multi-pane layout, search, and infinite scroll.
4. **Testing**: Done.

## QR Code Integration
Used `asharahmed/qr-cli` to generate and display the QR code in the terminal via `generateQRMatrix` and `renderQRCode`.
