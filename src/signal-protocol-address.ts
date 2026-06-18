import { SignalProtocolAddressType } from './';

/**
 * Represents a unique Signal address (user identifier + device ID).
 * Compatibility helper for the legacy libsignal API where addresses can be
 * round-tripped as `"name.deviceId"` strings.
 */
export class SignalProtocolAddress implements SignalProtocolAddressType {
    /**
     * Parses a string representation (`name.deviceId`) into an address.
     *
     * @param s Canonical string representation.
     */
    static fromString(s: string): SignalProtocolAddress {
        // Split on the LAST dot so names may contain dots, and require a
        // non-empty name plus an all-digits device id. An unanchored match
        // would otherwise accept `alice.1.extra` and mangle dotted names.
        const idx = s.lastIndexOf('.');
        const deviceId = idx >= 0 ? s.slice(idx + 1) : '';
        if (idx <= 0 || !/^\d+$/.test(deviceId)) {
            throw new Error(`Invalid SignalProtocolAddress string: ${s}`);
        }
        return new SignalProtocolAddress(s.slice(0, idx), parseInt(deviceId, 10));
    }

    private _name: string;
    private _deviceId: number;
    constructor(_name: string, _deviceId: number) {
        this._name = _name;
        this._deviceId = _deviceId;
    }

    // Readonly properties
    get name(): string {
        return this._name;
    }

    get deviceId(): number {
        return this._deviceId;
    }

    // Expose properties as fuynctions for compatibility
    getName(): string {
        return this._name;
    }

    getDeviceId(): number {
        return this._deviceId;
    }

    /**
     * Serialises the address as `name.deviceId`.
     */
    toString(): string {
        return `${this._name}.${this._deviceId}`;
    }

    /**
     * Compares two addresses for equality.
     */
    equals(other: SignalProtocolAddressType): boolean {
        return other.name === this._name && other.deviceId == this._deviceId;
    }
}
