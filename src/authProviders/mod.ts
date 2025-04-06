import {
  type Configuration,
  PublicClientApplication,
} from "@azure/msal-browser";
import { createConfig, SCOPES } from "./authConfig.ts";
import { getGraphClient, type UserOrgInfo } from "../credentials.ts";

export interface AuthProvider {
  init: () => Promise<void>;
  acquireToken: () => Promise<string>;
  // TODO: does org really belong here?
  org(): Promise<UserOrgInfo | undefined>;
}

export class MsalBrowserAuthProvider {
  private msalConfig?: Configuration;
  private msalInstance?: PublicClientApplication;
  public clientId: string;
  constructor(clientId: string) {
    this.clientId = clientId;
  }
  async init() {
    this.msalConfig = await createConfig(this.clientId);
    if (this.msalConfig) {
      this.msalInstance = new PublicClientApplication(this.msalConfig);
      await this.msalInstance.initialize();
    }
  }

  async acquireToken(): Promise<string> {
    if (!this.msalInstance) {
      await this.init();
    }
    if (!this.msalInstance) {
      throw new Error("Could not initialize msalInstance");
    }
    // const msalTokenCache = this.msalInstance.getTokenCache();
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      const silentRequest = {
        account: accounts[0], // Index must match the account that is trying to acquire token silently
        scopes: SCOPES,
      };
      // TODO: handle account selection
      return (await this.msalInstance.acquireTokenSilent(silentRequest))
        .idToken;
    } else {
      const loginRequest = {
        scopes: SCOPES,
        "prompt": "select_account",
      };
      console.log(loginRequest);
      await this.msalInstance.acquireTokenRedirect(loginRequest);
      throw new Error("unreachable");
    }
  }
  async org(): Promise<UserOrgInfo | undefined> {
    const graphClient = getGraphClient(await this.acquireToken());
    const user = await graphClient.api("/me").get();
    const org = (await graphClient.api("/organization?$select=displayName,id")
      .get()).value[0];
    let logoDataUrl: string | ArrayBuffer | null | undefined;
    try {
      const squareLogo = await graphClient.api(
        `/organization/${org.id}/branding/localizations/default/squareLogo`,
      ).get();
      logoDataUrl = await new Promise(
        (resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(squareLogo);
        },
      );
    } catch (_e) {
      console.warn(`no logo for organization ${org.displayName} (${org.id})`);
    }
    return {
      user,
      org,
      logoDataUrl: typeof logoDataUrl === "string" ? logoDataUrl : undefined,
    };
  }
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

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = String.fromCodePoint(...bytes);
  return btoa(binString);
}

export class KeyAuthProvider {
  private idKeyString: string;
  private idKeyBytes: Uint8Array;
  private secretKeyS: Uint8Array;
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
  org(): Promise<UserOrgInfo | undefined> {
    return Promise.resolve({
      user: {
        displayName: this.idKeyString,
      },
    });
  }
}

export class PasswordAuthProvider {
  #passwordToken?: string;
  public accountId: string;
  public username: string;
  private password: string;
  public api_endpoint: string = "https://api.smokecloud.io";
  constructor(
    accountId: string,
    username: string,
    password: string,
    api_endpoint: string = "https://api.smokecloud.io",
  ) {
    this.accountId = accountId;
    this.username = username;
    this.password = password;
    this.api_endpoint = api_endpoint;
  }
  private async passwordLogin(
    accountId: string,
    username: string,
    password: string,
  ) {
    const params = new URLSearchParams();
    params.set("accountid", accountId);
    params.set("username", username);
    params.set("password", password);
    const p = {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body: params.toString(),
    };
    const path = "login3";
    const url = new URL(this.api_endpoint);
    url.pathname = `/v3/${path}`;
    const request = new Request(url, p);
    const response = await fetch(request);
    if (response.status !== 302 && response.status !== 200) {
      const msg = await response.text();
      console.error(msg);
      throw new Error("Authorisation failed.");
    }
    const r = await response.json() as { jwt: string };
    this.#passwordToken = `pwd:${r.jwt}`;
    return response;
  }
  async init() {
    await this.passwordLogin(this.accountId, this.username, this.password);
  }

  async acquireToken(): Promise<string> {
    if (!this.#passwordToken) {
      await this.init();
    }
    if (!this.#passwordToken) throw new Error("no passwordToken");
    return this.#passwordToken;
  }
  org(): Promise<UserOrgInfo | undefined> {
    return Promise.resolve({
      user: {
        displayName: this.username,
      },
    });
  }
}
