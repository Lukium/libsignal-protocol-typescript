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
        if (!s.match(/.*\.\d+/)) {
            throw new Error(`Invalid SignalProtocolAddress string: ${s}`);
        }
        const parts = s.split('.');
        return new SignalProtocolAddress(parts[0], parseInt(parts[1]));
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
