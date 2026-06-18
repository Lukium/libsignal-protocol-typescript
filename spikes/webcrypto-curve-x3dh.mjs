/**
 * SPIKE: prove a WebCrypto-native (two-key, Olm-style) identity model can drive
 * an X3DH handshake — the feasibility gate for swapping the fork's asm.js
 * Curve25519 backend to native WebCrypto X25519 + Ed25519.
 *
 * Identity (per the non-canonical, Olm-style model):
 *   - Ed25519 key pair  -> signs the signed-prekey (replaces XEdDSA)
 *   - X25519  key pair  -> Diffie-Hellman in X3DH
 *
 * Proves:
 *   1. Ed25519 signed-prekey sign/verify (the signing path).
 *   2. X3DH 4-DH shared-secret agreement: Alice and Bob independently derive
 *      the SAME secret using WebCrypto X25519 deriveBits.
 *
 * Run: node spikes/webcrypto-curve-x3dh.mjs   (needs Node WebCrypto X25519/Ed25519)
 */
const subtle = globalThis.crypto.subtle;
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const concat = (...bufs) => {
  const arrs = bufs.map((b) => new Uint8Array(b));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out.buffer;
};

// --- key helpers -------------------------------------------------------------
const genX25519 = () => subtle.generateKey('X25519', true, ['deriveBits']);
const genEd25519 = () => subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const exportRaw = (k) => subtle.exportKey('raw', k);
const importX25519Pub = (raw) => subtle.importKey('raw', raw, 'X25519', false, []);
const importEd25519Pub = (raw) => subtle.importKey('raw', raw, 'Ed25519', false, ['verify']);
// X25519 DH: shared bits between my private key and their public key.
const dh = (myPriv, theirPubRaw) =>
  importX25519Pub(theirPubRaw).then((pub) =>
    subtle.deriveBits({ name: 'X25519', public: pub }, myPriv, 256)
  );

async function main() {
  // ---- Identities (two keys each) ----
  const aliceIdEd = await genEd25519();
  const aliceIdDh = await genX25519();
  const bobIdEd = await genEd25519();
  const bobIdDh = await genX25519();

  // ---- Bob's prekeys ----
  const bobSpk = await genX25519(); // signed prekey
  const bobOpk = await genX25519(); // one-time prekey

  // (1) Bob signs his signed-prekey PUBLIC with his Ed25519 identity key.
  const bobSpkPubRaw = await exportRaw(bobSpk.publicKey);
  const spkSig = await subtle.sign('Ed25519', bobIdEd.privateKey, bobSpkPubRaw);

  // Alice verifies the signed prekey using Bob's Ed25519 identity PUBLIC.
  const bobIdEdPubRaw = await exportRaw(bobIdEd.publicKey);
  const sigOk = await subtle.verify(
    'Ed25519',
    await importEd25519Pub(bobIdEdPubRaw),
    spkSig,
    bobSpkPubRaw
  );
  console.log('1) signed-prekey Ed25519 verify:', sigOk ? 'OK' : 'FAILED');

  // ---- Alice's ephemeral ----
  const aliceEk = await genX25519();

  // Publish raw public keys (simulate wire transfer).
  const aliceIdDhPubRaw = await exportRaw(aliceIdDh.publicKey);
  const aliceEkPubRaw = await exportRaw(aliceEk.publicKey);
  const bobIdDhPubRaw = await exportRaw(bobIdDh.publicKey);
  const bobOpkPubRaw = await exportRaw(bobOpk.publicKey);

  // (2) X3DH 4-DH. Alice's view (initiator):
  //   DH1 = DH(IK_A, SPK_B)   DH2 = DH(EK_A, IK_B)
  //   DH3 = DH(EK_A, SPK_B)   DH4 = DH(EK_A, OPK_B)
  const aliceSecret = concat(
    await dh(aliceIdDh.privateKey, bobSpkPubRaw),
    await dh(aliceEk.privateKey, bobIdDhPubRaw),
    await dh(aliceEk.privateKey, bobSpkPubRaw),
    await dh(aliceEk.privateKey, bobOpkPubRaw)
  );

  // Bob's view (responder) — mirror keys, same secret:
  //   DH1 = DH(SPK_B, IK_A)   DH2 = DH(IK_B, EK_A)
  //   DH3 = DH(SPK_B, EK_A)   DH4 = DH(OPK_B, EK_A)
  const bobSecret = concat(
    await dh(bobSpk.privateKey, aliceIdDhPubRaw),
    await dh(bobIdDh.privateKey, aliceEkPubRaw),
    await dh(bobSpk.privateKey, aliceEkPubRaw),
    await dh(bobOpk.privateKey, aliceEkPubRaw)
  );

  const agree = b64(aliceSecret) === b64(bobSecret);
  console.log('2) X3DH 4-DH shared secret agreement:', agree ? 'OK' : 'MISMATCH');
  console.log('   shared secret (truncated):', b64(aliceSecret).slice(0, 24), '...');

  // Negative control: a tampered signature must fail.
  const badSig = new Uint8Array(spkSig);
  badSig[0] ^= 0xff;
  const badOk = await subtle.verify(
    'Ed25519',
    await importEd25519Pub(bobIdEdPubRaw),
    badSig,
    bobSpkPubRaw
  );
  console.log('3) tampered signature rejected:', badOk ? 'FAILED (accepted!)' : 'OK');

  const pass = sigOk && agree && !badOk;
  console.log('\nSPIKE RESULT:', pass ? 'PASS — WebCrypto two-key X3DH is viable' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('SPIKE ERROR:', e);
  process.exit(1);
});
