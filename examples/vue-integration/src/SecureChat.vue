<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { injectSignalProtocol, type MessageType } from './composables/useSignalProtocol';
import type { DeviceType } from '@lukium/libsignal-protocol-typescript';

interface Message {
    id: string;
    sender: 'me' | 'them';
    text: string;
    encrypted: boolean;
}

const props = defineProps<{
    peerAddress: string;
    fetchPreKeyBundle: (address: string) => Promise<DeviceType>;
    sendToServer: (address: string, message: MessageType) => Promise<void>;
}>();

const { isInitialized, establishSession, hasSession, encrypt, decrypt } = injectSignalProtocol();

const messages = ref<Message[]>([]);
const inputText = ref('');
const sessionEstablished = ref(false);
const isConnecting = ref(false);
const error = ref<string | null>(null);

async function handleConnect() {
    isConnecting.value = true;
    error.value = null;

    try {
        const existing = await hasSession(props.peerAddress);
        if (existing) {
            sessionEstablished.value = true;
            return;
        }

        const preKeyBundle = await props.fetchPreKeyBundle(props.peerAddress);
        await establishSession(props.peerAddress, preKeyBundle);
        sessionEstablished.value = true;
    } catch (err) {
        error.value = `Failed to establish session: ${(err as Error).message}`;
    } finally {
        isConnecting.value = false;
    }
}

async function handleSend() {
    if (!inputText.value.trim() || !sessionEstablished.value) return;

    const text = inputText.value.trim();
    inputText.value = '';

    try {
        const ciphertext = await encrypt(props.peerAddress, text);

        messages.value.push({
            id: crypto.randomUUID(),
            sender: 'me',
            text,
            encrypted: true,
        });

        await props.sendToServer(props.peerAddress, ciphertext);
    } catch (err) {
        error.value = `Failed to send message: ${(err as Error).message}`;
    }
}

async function handleReceive(ciphertext: MessageType) {
    try {
        const plaintext = await decrypt(props.peerAddress, ciphertext);

        messages.value.push({
            id: crypto.randomUUID(),
            sender: 'them',
            text: plaintext,
            encrypted: true,
        });
    } catch (err) {
        error.value = `Failed to decrypt message: ${(err as Error).message}`;
    }
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        handleSend();
    }
}

function dismissError() {
    error.value = null;
}

// Expose handleReceive for external use
onMounted(() => {
    (window as unknown as { onEncryptedMessage?: typeof handleReceive }).onEncryptedMessage = handleReceive;
});

onUnmounted(() => {
    delete (window as unknown as { onEncryptedMessage?: typeof handleReceive }).onEncryptedMessage;
});
</script>

<template>
    <div class="secure-chat">
        <div v-if="!isInitialized" class="loading">
            <p>Initializing encryption...</p>
        </div>

        <template v-else>
            <div class="chat-header">
                <h3>Secure Chat with {{ peerAddress }}</h3>
                <span v-if="sessionEstablished" class="status connected">Encrypted</span>
                <button v-else :disabled="isConnecting" class="connect-btn" @click="handleConnect">
                    {{ isConnecting ? 'Connecting...' : 'Establish Secure Connection' }}
                </button>
            </div>

            <div v-if="error" class="error-banner">
                {{ error }}
                <button @click="dismissError">Dismiss</button>
            </div>

            <div class="messages">
                <div v-for="msg in messages" :key="msg.id" :class="['message', msg.sender]">
                    <span class="text">{{ msg.text }}</span>
                    <span v-if="msg.encrypted" class="lock-icon" title="End-to-end encrypted" />
                </div>
            </div>

            <div class="input-area">
                <input
                    v-model="inputText"
                    type="text"
                    :placeholder="sessionEstablished ? 'Type a message...' : 'Connect first to send messages'"
                    :disabled="!sessionEstablished"
                    @keydown="handleKeydown"
                />
                <button :disabled="!sessionEstablished || !inputText.trim()" @click="handleSend">Send</button>
            </div>
        </template>
    </div>
</template>

<style scoped>
.secure-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 600px;
    margin: 0 auto;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
}

.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
}

.chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
}

.chat-header h3 {
    margin: 0;
    font-size: 16px;
}

.status.connected {
    color: #28a745;
    font-size: 14px;
}

.connect-btn {
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.connect-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #f8d7da;
    color: #721c24;
    font-size: 14px;
}

.messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.message {
    max-width: 70%;
    margin-bottom: 12px;
    padding: 8px 12px;
    border-radius: 12px;
}

.message.me {
    margin-left: auto;
    background: #007bff;
    color: white;
}

.message.them {
    background: #e9ecef;
}

.lock-icon::after {
    content: '🔒';
    margin-left: 4px;
    font-size: 12px;
}

.input-area {
    display: flex;
    padding: 12px;
    border-top: 1px solid #ddd;
}

.input-area input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-right: 8px;
}

.input-area button {
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.input-area button:disabled {
    background: #ccc;
    cursor: not-allowed;
}
</style>
