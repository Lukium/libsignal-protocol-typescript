/**
 * WebSocket relay server for cross-browser Signal Protocol testing.
 *
 * This server acts as a simple relay - it does NOT see plaintext messages.
 * All encryption/decryption happens in the browsers.
 *
 * Usage:
 *   node examples/cross-browser-chat/server.mjs
 *
 * Then open http://localhost:3000 in two different browsers.
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// Bind to localhost by default; set HOST=0.0.0.0 to opt into LAN exposure.
const HOST = process.env.HOST || '127.0.0.1';

// Defensive limits for this demo relay (it is not a production server).
const MAX_WS_PAYLOAD_BYTES = 256 * 1024; // ws frames larger than this are rejected
const MAX_USERNAME_LENGTH = 32;
const MAX_CIPHERTEXT_BODY_LENGTH = 128 * 1024;
const MAX_BUNDLE_JSON_LENGTH = 16 * 1024;
// Conservative username charset: letters, digits, space, and a few separators.
const USERNAME_PATTERN = /^[\w .@-]{1,32}$/;

function sanitizeUsername(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!USERNAME_PATTERN.test(trimmed)) {
        return null;
    }
    return trimmed.slice(0, MAX_USERNAME_LENGTH);
}

function jsonByteLength(value) {
    try {
        return Buffer.byteLength(JSON.stringify(value));
    } catch {
        return Infinity;
    }
}

// Store connected clients and their pre-key bundles
const clients = new Map(); // clientId -> { ws, preKeyBundle, username }
let clientIdCounter = 0;

// Create HTTP server to serve the HTML client
const httpServer = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = join(__dirname, 'client.html');
        if (existsSync(htmlPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(readFileSync(htmlPath));
        } else {
            res.writeHead(404);
            res.end('Client HTML not found. Run from project root.');
        }
    } else if (req.url === '/bundle.js') {
        // Serve the bundled library (we'll create this)
        const bundlePath = join(__dirname, 'bundle.js');
        if (existsSync(bundlePath)) {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(readFileSync(bundlePath));
        } else {
            res.writeHead(404);
            res.end('Bundle not found. Run: yarn build:chat-demo');
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server with a hard frame-size cap so a single client cannot
// force the relay to buffer arbitrarily large payloads.
const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_WS_PAYLOAD_BYTES });

wss.on('connection', (ws) => {
    const clientId = ++clientIdCounter;
    clients.set(clientId, { ws, preKeyBundle: null, username: `User${clientId}` });

    console.log(`[Server] Client ${clientId} connected. Total clients: ${clients.size}`);

    // Send client their ID
    ws.send(JSON.stringify({
        type: 'WELCOME',
        clientId,
        message: 'Connected to Signal Protocol relay server'
    }));

    // Notify about other connected clients
    broadcastClientList();

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(clientId, message);
        } catch (err) {
            console.error(`[Server] Failed to parse message from client ${clientId}:`, err.message);
        }
    });

    ws.on('close', () => {
        console.log(`[Server] Client ${clientId} disconnected`);
        clients.delete(clientId);
        broadcastClientList();
    });

    ws.on('error', (err) => {
        console.error(`[Server] WebSocket error for client ${clientId}:`, err.message);
    });
});

function handleMessage(fromClientId, message) {
    const sender = clients.get(fromClientId);
    if (!sender) return;

    if (!message || typeof message.type !== 'string') {
        return;
    }

    switch (message.type) {
        case 'SET_USERNAME': {
            const username = sanitizeUsername(message.username);
            if (!username) {
                sender.ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid username' }));
                return;
            }
            sender.username = username;
            console.log(`[Server] Client ${fromClientId} set username: ${username}`);
            broadcastClientList();
            break;
        }

        case 'REGISTER_PREKEY_BUNDLE':
            // Client is registering their pre-key bundle (public keys only)
            if (
                message.bundle === null ||
                typeof message.bundle !== 'object' ||
                jsonByteLength(message.bundle) > MAX_BUNDLE_JSON_LENGTH
            ) {
                sender.ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid pre-key bundle' }));
                return;
            }
            sender.preKeyBundle = message.bundle;
            console.log(`[Server] Client ${fromClientId} (${sender.username}) registered pre-key bundle`);
            broadcastClientList();
            break;

        case 'REQUEST_PREKEY_BUNDLE':
            // Client wants another client's pre-key bundle to establish a session
            const targetId = message.targetClientId;
            const target = clients.get(targetId);
            if (target && target.preKeyBundle) {
                sender.ws.send(JSON.stringify({
                    type: 'PREKEY_BUNDLE',
                    fromClientId: targetId,
                    fromUsername: target.username,
                    bundle: target.preKeyBundle
                }));
                console.log(`[Server] Sent ${target.username}'s pre-key bundle to ${sender.username}`);
            } else {
                sender.ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: `Client ${targetId} not found or has no pre-key bundle`
                }));
            }
            break;

        case 'ENCRYPTED_MESSAGE': {
            // Relay encrypted message to target (server CANNOT read this!)
            const ciphertext = message.ciphertext;
            if (
                ciphertext === null ||
                typeof ciphertext !== 'object' ||
                (typeof ciphertext.body === 'string' && ciphertext.body.length > MAX_CIPHERTEXT_BODY_LENGTH) ||
                jsonByteLength(ciphertext) > MAX_WS_PAYLOAD_BYTES
            ) {
                sender.ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid ciphertext payload' }));
                return;
            }
            const recipientId = message.toClientId;
            const recipient = clients.get(recipientId);
            if (recipient) {
                recipient.ws.send(JSON.stringify({
                    type: 'ENCRYPTED_MESSAGE',
                    fromClientId,
                    fromUsername: sender.username,
                    ciphertext: message.ciphertext
                }));
                console.log(`[Server] Relayed encrypted message from ${sender.username} to ${recipient.username} (${message.ciphertext.body?.length || 0} bytes)`);
            } else {
                sender.ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: `Recipient ${recipientId} not connected`
                }));
            }
            break;
        }

        default:
            console.log(`[Server] Unknown message type from ${fromClientId}:`, message.type);
    }
}

function broadcastClientList() {
    const clientList = [];
    for (const [id, client] of clients) {
        clientList.push({
            clientId: id,
            username: client.username,
            hasPreKeyBundle: !!client.preKeyBundle
        });
    }

    const message = JSON.stringify({
        type: 'CLIENT_LIST',
        clients: clientList
    });

    for (const [, client] of clients) {
        client.ws.send(message);
    }
}

// Bind to localhost by default; set HOST=0.0.0.0 to expose on the LAN (e.g. to
// reach the demo from a Windows host in WSL2). Exposing it shares the relay with
// anyone on your network, so opt in deliberately.
httpServer.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║     Signal Protocol Cross-Browser Chat Demo                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Server running at: http://localhost:${PORT}                     ║
║                                                                ║
║  Instructions:                                                 ║
║  1. Open http://localhost:${PORT} in Browser A (e.g., Chrome)    ║
║  2. Open http://localhost:${PORT} in Browser B (e.g., Firefox)   ║
║  3. Set usernames for each browser                             ║
║  4. Click "Connect" on one user to establish a session         ║
║  5. Send encrypted messages back and forth!                    ║
║                                                                ║
║  The server only relays encrypted blobs - it cannot read       ║
║  your messages. All crypto happens in the browser.             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);
});
