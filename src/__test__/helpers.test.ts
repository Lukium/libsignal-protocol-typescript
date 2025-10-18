import { arrayBufferToString, binaryStringToArrayBuffer, isEqual, uint8ArrayToString } from '../helpers';

describe('helpers', () => {
    test('uint8ArrayToString handles empty arrays', () => {
        expect(uint8ArrayToString(new Uint8Array())).toBe('');
    });

    test('uint8ArrayToString chunks large arrays', () => {
        const data = new Uint8Array(1025);
        data.fill(65); // 'A'
        const text = uint8ArrayToString(data);
        expect(text.length).toBe(1025);
        expect(text.startsWith('A')).toBe(true);
        expect(text.endsWith('A')).toBe(true);
    });

    test('binaryStringToArrayBuffer rejects high code points', () => {
        expect(() => binaryStringToArrayBuffer('\u0100')).toThrow(RangeError);
    });

    test('isEqual returns false when either side missing', () => {
        const buffer = new Uint8Array(6).buffer;
        expect(isEqual(undefined, buffer)).toBe(false);
        expect(isEqual(buffer, undefined)).toBe(false);
    });

    test('isEqual throws when buffers too short', () => {
        const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
        expect(() => isEqual(buffer, buffer)).toThrow('a/b compare too short');
    });

    test('isEqual compares long buffers', () => {
        const baseArray = [1, 2, 3, 4, 5, 6];
        const base = new Uint8Array(baseArray).buffer;
        const identical = new Uint8Array(baseArray).buffer;
        const samePrefix = new Uint8Array([1, 2, 3, 4, 5, 9]).buffer;
        const different = new Uint8Array([9, 9, 9, 9, 9, 9]).buffer;
        expect(isEqual(base, identical)).toBe(true);
        expect(isEqual(base, samePrefix)).toBe(false);
        expect(isEqual(base, different)).toBe(false);
    });

    test('arrayBufferToString mirrors uint8ArrayToString', () => {
        const buffer = new Uint8Array([70, 79, 79, 66, 65, 82]).buffer;
        expect(arrayBufferToString(buffer)).toBe('FOOBAR');
    });
});
