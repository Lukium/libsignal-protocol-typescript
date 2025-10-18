import { getLogger, setLogger } from '../logger';

describe('logger customisation', () => {
    afterEach(() => {
        setLogger();
    });

    test('provides console-backed defaults', () => {
        const logger = getLogger();
        expect(typeof logger.warn).toBe('function');
    });

    test('allows overriding individual levels', () => {
        const warn = jest.fn();
        setLogger({ warn });
        getLogger().warn('test');
        expect(warn).toHaveBeenCalledWith('test', undefined);
    });

    test('restores defaults when reset', () => {
        const warn = jest.fn();
        setLogger({ warn });
        setLogger();
        const defaultWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        getLogger().warn('default');
        expect(defaultWarn).toHaveBeenCalledWith('default');
        defaultWarn.mockRestore();
    });

    test('forwards context to default logger', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        getLogger().warn('context message', { foo: 'bar' });
        expect(warnSpy).toHaveBeenCalledWith('context message', { foo: 'bar' });
        warnSpy.mockRestore();
    });

    test('merges partial overrides with defaults', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const error = jest.fn();
        setLogger({ error });
        getLogger().warn('merged warn');
        getLogger().error('merged error');
        expect(warnSpy).toHaveBeenCalledWith('merged warn');
        expect(error).toHaveBeenCalledWith('merged error', undefined);
        warnSpy.mockRestore();
    });

    test('default logger forwards error context', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        getLogger().error('context error', { foo: 'bar' });
        expect(errorSpy).toHaveBeenCalledWith('context error', { foo: 'bar' });
        errorSpy.mockRestore();
    });
});
