import createLibsignal from '../index'
import { Curve } from '../curve'

describe('index entrypoint', () => {
    test('resolves with curve facade', async () => {
        const module = await createLibsignal()
        expect(module.Curve).toBeInstanceOf(Curve)
        expect(typeof module.Curve.generateKeyPair).toBe('function')
        expect(typeof module.Curve.async.generateKeyPair).toBe('function')
    })
})
