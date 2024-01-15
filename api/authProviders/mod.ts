import { Configuration, InteractiveRequest, PublicClientApplication } from "@azure/msal-node";
import { createConfig } from "./authConfig.ts";
// import open from "open";
// import { open } from "https://deno.land/x/open@v0.0.6/index.ts";
// import fetch from "node-fetch";
import dns from "node:dns";
import { UserOrgInfo, getGraphClient } from "../credentials.ts";
import Base64 from "crypto-js/enc-base64";
import hmacSHA256 from "crypto-js/hmac-sha256";
import CryptoJS from "crypto-js";
import { LoginData } from "../coreTypes.ts";

dns.setDefaultResultOrder("ipv4first");

const SCOPES = ["User.Read", "email"];

// Open browser to sign user in and consent to scopes needed for application
async function openBrowser(url: string): Promise<void> {
  console.log("opening to: ", url)
  // TODO: get this to work with Deno
  // console.log("opening to: ", encodeURI(url))
  // await open(`${url}`, { url: false });
};

export function authFromLoginData(loginData: LoginData): AuthProvider {
  switch (loginData.type) {
    case "microsoft":
      return new MsalAuthProvider("e28c2818-dde5-4ba5-8bc4-482bfa57846b");
    case "password":
      return new PasswordAuthProvider(loginData.account_id, loginData.username, loginData.password);
    case "keys":
      return new KeyAuthProvider(loginData.id_key, loginData.secret_key);

  }

}

export interface AuthProvider {
  init: () => Promise<void>;
  acquireToken: () => Promise<string>;
  // TODO: does org really belong here?
  org(): Promise<UserOrgInfo | undefined>;
}
// TODO: distinguish between native and web
export class MsalAuthProvider {
  private initialized = false;
  private msalConfig?: Configuration;
  constructor(public clientId: string) {
  }
  async init() {
    this.msalConfig = await createConfig(this.clientId);
    this.initialized = true;
  }

  async acquireToken(): Promise<string> {
    if (!this.initialized) {
      await this.init();
    }
    if (!this.msalConfig) {
      throw new Error("Could not initialize msalConfig");
    }
    const pca = new PublicClientApplication(this.msalConfig);
    const msalTokenCache = pca.getTokenCache();
    const accounts = await msalTokenCache.getAllAccounts();
    if (accounts.length > 0) {
      const silentRequest = {
        account: accounts[0], // Index must match the account that is trying to acquire token silently
        scopes: SCOPES,
      };

      return (await pca.acquireTokenSilent(silentRequest)).idToken;
    } else {
      const loginRequest: InteractiveRequest = {
        scopes: SCOPES,
        openBrowser,
        successTemplate: "Successfully signed in! You can close this window now.",
        "prompt": "select_account"
      };
      console.log(loginRequest)
      return (await pca.acquireTokenInteractive(loginRequest)).idToken;
    }
  }
  async org(): Promise<UserOrgInfo | undefined> {
    const graphClient = getGraphClient(await this.acquireToken());
    const user = await graphClient.api("/me").get();
    const org =
      (await graphClient.api("/organization?$select=displayName,id")
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
      console.warn(`no logo for organization ${org.displayName} (${org.id})`)
    }
    return {
      user,
      org,
      logoDataUrl: typeof logoDataUrl === "string" ? logoDataUrl : undefined,
    };
  }
}


export class KeyAuthProvider {
  private idKey: CryptoJS.lib.WordArray;
  private secretKey: CryptoJS.lib.WordArray;
  private hmacDigest: string;
  #token: string;
  constructor(idKey: string, secretKey: string) {
    this.idKey = Base64.parse(idKey);
    this.secretKey = Base64.parse(secretKey);
    this.hmacDigest = Base64.stringify(hmacSHA256(this.idKey, this.secretKey));
    this.#token = `${Base64.stringify(this.idKey)}:${this.hmacDigest}`;
  }
  async init() { }

  acquireToken(): Promise<string> {
    return Promise.resolve(this.#token);
  }
  org(): Promise<UserOrgInfo | undefined> {
    return Promise.resolve({
      user: {
        displayName: Base64.stringify(this.idKey),
      },
    });
  }
}


export class PasswordAuthProvider {
  #passwordToken?: string;
  constructor(public accountId: string, public username: string, private password: string, public api_endpoint: string = "https://api.smokecloud.io") {
  }
  private async passwordLogin(accountId: string, username: string, password: string) {
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
