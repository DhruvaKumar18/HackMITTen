/**
 * End-to-End Encryption (E2EE) Module for Chatvia
 * 
 * Algorithm Details:
 * 1. Key Exchange: ECDH (Elliptic-Curve Diffie-Hellman) on NIST Curve P-256 (secp256r1)
 * 2. Symmetric Cipher: AES-GCM (Galois/Counter Mode) with 256-bit key length
 * 3. Nonce / IV: 12-byte (96-bit) cryptographically secure random Initialization Vector per message
 * 4. Authenticated Data (AEAD): Built-in 128-bit authentication tag guarantees confidentiality and tamper detection
 */

// Pre-seeded keypairs for instant demo in split-screen mode or clean browser profiles
export const DEMO_E2EE_KEYPAIRS: Record<string, { pub: JsonWebKey; priv: JsonWebKey }> = {
  u_doris: {
    pub: {
      key_ops: [],
      ext: true,
      kty: "EC",
      x: "DytdV38Hk_yFbhhnvwFeWxSBJM12lgLAeORqYvBmWnE",
      y: "1mllunFdQIGm31iUmOIWp3yWDtMl2thWi41fMSoB60Y",
      crv: "P-256",
    },
    priv: {
      key_ops: ["deriveKey"],
      ext: true,
      kty: "EC",
      x: "DytdV38Hk_yFbhhnvwFeWxSBJM12lgLAeORqYvBmWnE",
      y: "1mllunFdQIGm31iUmOIWp3yWDtMl2thWi41fMSoB60Y",
      crv: "P-256",
      d: "HQeynqeKkQJbxGGbmnjZOtR4c3FUA69ALee5oDxF7A0",
    },
  },
  u_patrick: {
    pub: {
      key_ops: [],
      ext: true,
      kty: "EC",
      x: "i1OK_GwWlbj0S46-6vXqRnab2KxOywNxxEbRUwip8Ys",
      y: "sAgdAWs8rxg_7mMiZzv0TQTBw5q2st37LnBF4ilsYc8",
      crv: "P-256",
    },
    priv: {
      key_ops: ["deriveKey"],
      ext: true,
      kty: "EC",
      x: "i1OK_GwWlbj0S46-6vXqRnab2KxOywNxxEbRUwip8Ys",
      y: "sAgdAWs8rxg_7mMiZzv0TQTBw5q2st37LnBF4ilsYc8",
      crv: "P-256",
      d: "o_hX1_Z7P73JpU5nXomHNzhhW9yMJR4LZkWOLQn7zRo",
    },
  },
  u_steve: {
    pub: {
      key_ops: [],
      ext: true,
      kty: "EC",
      x: "i0XNjB8ZQnI-QTzZ51eakTJRbEFwJlcvO0thhxNIpoI",
      y: "kzNna8I2AXY8ymOYUG72eZi1GmkWlvxRa8XViOWT2Lo",
      crv: "P-256",
    },
    priv: {
      key_ops: ["deriveKey"],
      ext: true,
      kty: "EC",
      x: "i0XNjB8ZQnI-QTzZ51eakTJRbEFwJlcvO0thhxNIpoI",
      y: "kzNna8I2AXY8ymOYUG72eZi1GmkWlvxRa8XViOWT2Lo",
      crv: "P-256",
      d: "Qo1FNNXNsyURZF6xGVJDx4KD8KXKvu_46S6UJ7qMw48",
    },
  },
  u_mark: {
    pub: {
      key_ops: [],
      ext: true,
      kty: "EC",
      x: "Tcb5WolQ42kos_aopvh7I9gMOno8T7T_bYB2i3BxQPE",
      y: "18UaVglMkGjC4ZeMXNiOTdYogoPWaQ9PgRVDzaIW4jQ",
      crv: "P-256",
    },
    priv: {
      key_ops: ["deriveKey"],
      ext: true,
      kty: "EC",
      x: "Tcb5WolQ42kos_aopvh7I9gMOno8T7T_bYB2i3BxQPE",
      y: "18UaVglMkGjC4ZeMXNiOTdYogoPWaQ9PgRVDzaIW4jQ",
      crv: "P-256",
      d: "lLkORrl1a0xdIeCI2hGbQLSQ1E87wPZ1KoE1NnGr7eA",
    },
  },
  u_emily: {
    pub: {
      key_ops: [],
      ext: true,
      kty: "EC",
      x: "7aTbM365DjSeT47_ATI8FFChhSJsI13ZGDdN8TXLu8w",
      y: "4quwgg4VY_3TxFgedD-Rz00AxEJ8CyTVDuGIO6JZ5ec",
      crv: "P-256",
    },
    priv: {
      key_ops: ["deriveKey"],
      ext: true,
      kty: "EC",
      x: "7aTbM365DjSeT47_ATI8FFChhSJsI13ZGDdN8TXLu8w",
      y: "4quwgg4VY_3TxFgedD-Rz00AxEJ8CyTVDuGIO6JZ5ec",
      crv: "P-256",
      d: "T9F4DBsM-oQ7dFjU76PmAwXdcU7eOEI9Lc3VNiqJE_A",
    },
  },
};

// In-memory cache for derived AES-GCM shared keys
const sharedKeyCache = new Map<string, CryptoKey>();
// In-memory cache for loaded private keys
const privateKeyCache = new Map<string, CryptoKey>();

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Initializes or retrieves the local ECDH keypair for the given user.
 * Returns the public key JWK so it can be registered on the server.
 */
export async function initUserE2EE(userId: string): Promise<JsonWebKey> {
  const privStorageKey = `chatvia_e2ee_priv_${userId}`;
  const pubStorageKey = `chatvia_e2ee_pub_${userId}`;

  let privJwkStr = localStorage.getItem(privStorageKey);
  let pubJwkStr = localStorage.getItem(pubStorageKey);

  let privJwk: JsonWebKey | null = privJwkStr ? JSON.parse(privJwkStr) : null;
  let pubJwk: JsonWebKey | null = pubJwkStr ? JSON.parse(pubJwkStr) : null;

  if (!privJwk || !pubJwk) {
    if (DEMO_E2EE_KEYPAIRS[userId]) {
      privJwk = DEMO_E2EE_KEYPAIRS[userId].priv;
      pubJwk = DEMO_E2EE_KEYPAIRS[userId].pub;
    } else {
      // Generate new ECDH P-256 keypair
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      );
      pubJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      privJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    }

    localStorage.setItem(privStorageKey, JSON.stringify(privJwk));
    localStorage.setItem(pubStorageKey, JSON.stringify(pubJwk));
  }

  // Import private key into CryptoKey cache
  const privKey = await window.crypto.subtle.importKey(
    'jwk',
    privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
  privateKeyCache.set(userId, privKey);

  // Sync public key with the server
  try {
    await fetch('/api/users/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, publicKey: JSON.stringify(pubJwk) }),
    });
  } catch (err) {
    console.warn('Could not sync E2EE public key to server:', err);
  }

  return pubJwk;
}

/**
 * Returns the cached or imported ECDH private key for a user.
 */
export async function getUserPrivateKey(userId: string): Promise<CryptoKey> {
  if (privateKeyCache.has(userId)) {
    return privateKeyCache.get(userId)!;
  }

  const privStorageKey = `chatvia_e2ee_priv_${userId}`;
  let privJwkStr = localStorage.getItem(privStorageKey);
  let privJwk: JsonWebKey;

  if (privJwkStr) {
    privJwk = JSON.parse(privJwkStr);
  } else if (DEMO_E2EE_KEYPAIRS[userId]) {
    privJwk = DEMO_E2EE_KEYPAIRS[userId].priv;
  } else {
    await initUserE2EE(userId);
    return privateKeyCache.get(userId)!;
  }

  const privKey = await window.crypto.subtle.importKey(
    'jwk',
    privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
  privateKeyCache.set(userId, privKey);
  return privKey;
}

/**
 * Derives a shared AES-256-GCM key between my private key and peer's public key.
 */
export async function getSharedKey(
  myUserId: string,
  peerUserId: string,
  peerPublicKeyRaw?: string | JsonWebKey | null
): Promise<CryptoKey | null> {
  const cacheKey = [myUserId, peerUserId].sort().join('_');
  if (sharedKeyCache.has(cacheKey)) {
    return sharedKeyCache.get(cacheKey)!;
  }

  let peerPubJwk: JsonWebKey | null = null;
  if (typeof peerPublicKeyRaw === 'string' && peerPublicKeyRaw.trim().startsWith('{')) {
    try {
      peerPubJwk = JSON.parse(peerPublicKeyRaw);
    } catch {
      peerPubJwk = null;
    }
  } else if (typeof peerPublicKeyRaw === 'object' && peerPublicKeyRaw) {
    peerPubJwk = peerPublicKeyRaw;
  }

  // Fallback to demo public key if not found
  if (!peerPubJwk && DEMO_E2EE_KEYPAIRS[peerUserId]) {
    peerPubJwk = DEMO_E2EE_KEYPAIRS[peerUserId].pub;
  }

  if (!peerPubJwk) {
    // Attempt to fetch from server
    try {
      const res = await fetch(`/api/users/${peerUserId}/key`);
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) {
          peerPubJwk = JSON.parse(data.publicKey);
        }
      }
    } catch {
      // server lookup failed
    }
  }

  if (!peerPubJwk) {
    return null;
  }

  try {
    const myPrivKey = await getUserPrivateKey(myUserId);
    const peerPubKey = await window.crypto.subtle.importKey(
      'jwk',
      peerPubJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedKey = await window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPubKey },
      myPrivKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    sharedKeyCache.set(cacheKey, sharedKey);
    return sharedKey;
  } catch (err) {
    console.error('Failed to derive ECDH shared key:', err);
    return null;
  }
}

/**
 * Encrypts a message using the derived AES-256-GCM key with a 12-byte random IV.
 * Returns an envelope string: e2ee:{"v":1,"iv":"...","ct":"..."}
 */
export async function encryptMessage(
  plainText: string,
  sharedKey: CryptoKey
): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );

  const envelope = {
    v: 1,
    iv: arrayBufferToBase64(iv),
    ct: arrayBufferToBase64(ciphertextBuffer),
  };

  return `e2ee:${JSON.stringify(envelope)}`;
}

/**
 * Checks if a message string was encrypted with Chatvia E2EE.
 */
export function isE2EEMessage(content: string): boolean {
  return typeof content === 'string' && content.startsWith('e2ee:{"v":');
}

/**
 * Decrypts a message envelope. If not encrypted or decryption fails, returns appropriate status.
 */
export async function decryptMessage(
  envelopeString: string,
  sharedKey: CryptoKey | null
): Promise<{ text: string; isEncrypted: boolean }> {
  if (!isE2EEMessage(envelopeString)) {
    return { text: envelopeString, isEncrypted: false };
  }

  if (!sharedKey) {
    return { text: '🔒 [Encrypted message - key pending]', isEncrypted: true };
  }

  try {
    const jsonStr = envelopeString.slice(5);
    const envelope = JSON.parse(jsonStr);
    const iv = base64ToUint8Array(envelope.iv);
    const ct = base64ToUint8Array(envelope.ct);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      sharedKey,
      ct.buffer as ArrayBuffer
    );

    const plainText = new TextDecoder().decode(decryptedBuffer);
    return { text: plainText, isEncrypted: true };
  } catch (err) {
    console.error('E2EE Decryption error:', err);
    return { text: '⚠️ [Unable to decrypt message]', isEncrypted: true };
  }
}
