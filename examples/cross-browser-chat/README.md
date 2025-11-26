# Cross-Browser Chat Demo

This demo lets you test the Signal Protocol with **real end-to-end encryption** between multiple browsers.

## How It Works

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Browser A  │◄────────►│   Server    │◄────────►│  Browser B  │
│   (Alice)   │          │   (Relay)   │          │    (Bob)    │
└─────────────┘          └─────────────┘          └─────────────┘
      │                        │                        │
      │    Encrypted blobs     │                        │
      │ ◄──────────────────────►                        │
      │                        │    Encrypted blobs     │
      │                        │ ◄──────────────────────►
      │                        │                        │
      ▼                        ▼                        ▼
   Plaintext              CANNOT READ              Plaintext
   visible                 messages               visible
   here                                           here
```

The server acts as a simple relay - it **cannot read your messages**. All encryption and decryption happens in the browser using:

- **X3DH** - Extended Triple Diffie-Hellman for session establishment
- **Double Ratchet** - Forward-secure message encryption

## Features

- **Multi-user support** - Connect 3+ browsers simultaneously
- **Per-conversation message history** - Each chat is isolated; switching users shows only that conversation
- **Unread message indicators** - Badge shows unread count with pulsing animation
- **Automatic PreKey rotation** - Fresh PreKeys generated after each session establishment
- **Real-time protocol logging** - Watch X3DH and Double Ratchet in action
- **Error handling** - Clear error messages for encryption/decryption failures

## Quick Start

```bash
# From the project root
yarn example:chat
```

Then:
1. Open http://localhost:3000 in **Chrome** (User 1)
2. Open http://localhost:3000 in **Firefox** (User 2)
3. Optionally open in **Chrome Incognito** (User 3)
4. Set usernames for each browser
5. Click "Connect" on one user to establish an encrypted session
6. Send messages back and forth!

## What You'll See

### Protocol Log

Watch the protocol in action:
- Key generation (Identity keys, PreKeys, Signed PreKeys)
- X3DH session establishment
- Double Ratchet encryption/decryption
- PreKey rotation after session establishment
- Message types (PreKeyWhisper vs Whisper)

### Server Console

The server logs show:
- Client connections/disconnections
- Pre-key bundle registrations and updates
- Encrypted message relay (size only - content is encrypted!)

### Chat UI

- **User list** - Shows all connected users with session status
- **Unread badges** - Red badge with count for new messages
- **Separate conversations** - Each user has their own message history
- **Session indicators** - Green border for active sessions

## Manual Build & Run

If you need to rebuild:

```bash
# Build the library and browser bundle
yarn build:chat

# Start the server
node examples/cross-browser-chat/server.mjs
```

## Architecture

```
examples/cross-browser-chat/
├── server.mjs       # WebSocket relay server (Node.js)
├── client.html      # Browser UI with embedded JavaScript
├── browser-entry.mjs # Entry point for esbuild
├── build-bundle.mjs # esbuild configuration
├── bundle.js        # Generated browser bundle (gitignored)
└── README.md        # This file
```

## Security Notes

- The server only sees encrypted ciphertext
- Each browser generates its own identity keys
- Sessions use forward secrecy (compromising one message doesn't expose others)
- PreKeys are rotated after each use to support multiple simultaneous users
- This is a demo - production apps should persist keys in IndexedDB

## Testing Different Scenarios

### Normal Flow
1. Alice connects to Bob
2. Alice sends first message (PreKeyWhisperMessage)
3. Bob receives and decrypts
4. Bob replies (WhisperMessage)
5. Continue chatting with forward secrecy

### Multi-User Flow
1. Open 3 browsers (Chrome, Firefox, Chrome Incognito)
2. Chrome connects to Firefox - both can chat
3. Chrome connects to Incognito - both can chat
4. Firefox connects to Incognito - both can chat
5. All three users can now communicate in separate encrypted sessions

### Message Types
- **Type 3 (PreKeyWhisperMessage)**: First message, contains key exchange data
- **Type 1 (WhisperMessage)**: Subsequent messages, smaller and faster

## Troubleshooting

### "WebSocket connection failed"
- Make sure the server is running (`yarn example:chat`)
- Check that port 3000 isn't in use by another process

### "No users connected"
- Open the URL in two different browsers or browser profiles
- The same browser with two tabs won't work well (shared storage)

### "Failed to decrypt" or "Bad MAC"
- Sessions are in-memory; refreshing clears them
- Establish a new session after refreshing either browser

### WSL2 Users
The server binds to `0.0.0.0` so you can access it from Windows at `http://localhost:3000`
