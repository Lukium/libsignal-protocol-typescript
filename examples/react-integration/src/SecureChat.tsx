import React, { useState, useCallback } from 'react';
import { useSignalProtocol, type MessageType, type DeviceType } from './signal-protocol';

interface Message {
    id: string;
    sender: 'me' | 'them';
    text: string;
    encrypted: boolean;
}

interface SecureChatProps {
    /** Remote peer's address (e.g., "user123:1") */
    peerAddress: string;
    /** Function to fetch peer's pre-key bundle from your server */
    fetchPreKeyBundle: (address: string) => Promise<DeviceType>;
    /** Function to send encrypted message to your server */
    sendToServer: (address: string, message: MessageType) => Promise<void>;
}

/**
 * Example secure chat component using the Signal Protocol.
 *
 * This demonstrates:
 * - Session establishment with a peer
 * - Encrypting outgoing messages
 * - Decrypting incoming messages
 */
export function SecureChat({ peerAddress, fetchPreKeyBundle, sendToServer }: SecureChatProps) {
    const { isInitialized, establishSession, hasSession, encrypt, decrypt } = useSignalProtocol();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [sessionEstablished, setSessionEstablished] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            // Check if we already have a session
            const existing = await hasSession(peerAddress);
            if (existing) {
                setSessionEstablished(true);
                return;
            }

            // Fetch peer's pre-key bundle from server
            const preKeyBundle = await fetchPreKeyBundle(peerAddress);

            // Establish session using X3DH
            await establishSession(peerAddress, preKeyBundle);
            setSessionEstablished(true);
        } catch (err) {
            setError(`Failed to establish session: ${(err as Error).message}`);
        } finally {
            setIsConnecting(false);
        }
    }, [peerAddress, hasSession, establishSession, fetchPreKeyBundle]);

    const handleSend = useCallback(async () => {
        if (!inputText.trim() || !sessionEstablished) return;

        const text = inputText.trim();
        setInputText('');

        try {
            // Encrypt the message
            const ciphertext = await encrypt(peerAddress, text);

            // Add to local messages (optimistic update)
            const newMessage: Message = {
                id: crypto.randomUUID(),
                sender: 'me',
                text,
                encrypted: true,
            };
            setMessages((prev) => [...prev, newMessage]);

            // Send to server
            await sendToServer(peerAddress, ciphertext);
        } catch (err) {
            setError(`Failed to send message: ${(err as Error).message}`);
        }
    }, [inputText, sessionEstablished, encrypt, peerAddress, sendToServer]);

    const handleReceive = useCallback(
        async (ciphertext: MessageType) => {
            try {
                // Decrypt the message
                const plaintext = await decrypt(peerAddress, ciphertext);

                const newMessage: Message = {
                    id: crypto.randomUUID(),
                    sender: 'them',
                    text: plaintext,
                    encrypted: true,
                };
                setMessages((prev) => [...prev, newMessage]);
            } catch (err) {
                setError(`Failed to decrypt message: ${(err as Error).message}`);
            }
        },
        [decrypt, peerAddress]
    );

    // Expose handleReceive for parent component to call when messages arrive
    // In a real app, you'd use WebSocket or polling to receive messages
    React.useEffect(() => {
        // Example: expose to window for demo purposes
        (window as unknown as { onEncryptedMessage?: typeof handleReceive }).onEncryptedMessage = handleReceive;
        return () => {
            delete (window as unknown as { onEncryptedMessage?: typeof handleReceive }).onEncryptedMessage;
        };
    }, [handleReceive]);

    if (!isInitialized) {
        return (
            <div className="secure-chat loading">
                <p>Initializing encryption...</p>
            </div>
        );
    }

    return (
        <div className="secure-chat">
            <div className="chat-header">
                <h3>Secure Chat with {peerAddress}</h3>
                {sessionEstablished ? (
                    <span className="status connected">Encrypted</span>
                ) : (
                    <button onClick={handleConnect} disabled={isConnecting} className="connect-btn">
                        {isConnecting ? 'Connecting...' : 'Establish Secure Connection'}
                    </button>
                )}
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            <div className="messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.sender}`}>
                        <span className="text">{msg.text}</span>
                        {msg.encrypted && <span className="lock-icon" title="End-to-end encrypted" />}
                    </div>
                ))}
            </div>

            <div className="input-area">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={sessionEstablished ? 'Type a message...' : 'Connect first to send messages'}
                    disabled={!sessionEstablished}
                />
                <button onClick={handleSend} disabled={!sessionEstablished || !inputText.trim()}>
                    Send
                </button>
            </div>
        </div>
    );
}

/**
 * Example usage:
 *
 * ```tsx
 * import { SignalProtocolProvider } from './signal-protocol';
 * import { SecureChat } from './SecureChat';
 *
 * function App() {
 *   return (
 *     <SignalProtocolProvider>
 *       <SecureChat
 *         peerAddress="bob:1"
 *         fetchPreKeyBundle={async (address) => {
 *           const response = await fetch(`/api/keys/${address}`);
 *           return response.json();
 *         }}
 *         sendToServer={async (address, message) => {
 *           await fetch(`/api/messages/${address}`, {
 *             method: 'POST',
 *             body: JSON.stringify(message),
 *           });
 *         }}
 *       />
 *     </SignalProtocolProvider>
 *   );
 * }
 * ```
 */
