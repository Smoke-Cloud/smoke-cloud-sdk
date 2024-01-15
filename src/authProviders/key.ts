export class KeyAuthProvider {
  private idKeyString: string;
  private idKeyBytes: Uint8Array<ArrayBuffer>;
  private secretKeyS: Uint8Array<ArrayBuffer>;
  private secretKey?: CryptoKey;
  private hmacDigest?: string;
  #token?: string;
  constructor(idKey: string, secretKey: string) {
    this.idKeyString = idKey;
    this.idKeyBytes = base64ToBytes(idKey);
    this.secretKeyS = base64ToBytes(secretKey);
  }
  async init() {
    this.secretKey = await importKey(this.secretKeyS);
    this.hmacDigest = bytesToBase64(
      await hmac(this.secretKey, this.idKeyBytes),
    );
    this.#token = `${this.idKeyString}:${this.hmacDigest}`;
  }

  async acquireToken(): Promise<string> {
    if (!this.#token) {
      await this.init();
    }
    if (this.#token) {
      return this.#token;
    } else {
      throw new Error("Could not initialize token");
    }
  }
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

async function importKey(keyData: BufferSource) {
  return await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"],
  );
}

async function hmac(key: CryptoKey, data: BufferSource) {
  const signature = await globalThis.crypto.subtle.sign(
    {
      name: "HMAC",
    },
    key,
    data,
  );
  return new Uint8Array(signature);
}
