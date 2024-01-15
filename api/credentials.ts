import * as jose from "jose";
import { LoginData } from "./coreTypes.ts";
import { ApiClient } from "./api.ts";
import { Client, AuthProviderCallback as MsalGraphAuthProviderCallback } from "@microsoft/microsoft-graph-client";
import { authFromLoginData } from "./authProviders/mod.ts";

export interface UserOrgInfo {
  user?: {
    displayName: string;
    mail?: string;
  },
  org?: {
    displayName?: string;
  },
  logoDataUrl?: string;
};

export type CliContext = CliContextMs | CliContextKeys
export type CliContextMs = BaseCliContext & Tokens & { received: number, id_key: undefined }
export type CliContextKeys = BaseCliContext & { id_key: string, secret_key: string, access_token: undefined }

export type BaseCliContext = {
  account_id: string;
  endpoint?: string;
  default_fds_version?: string;
}


export type Tokens = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

export class CredentialSet {
  #credentials: LoginData;
  #userOrgInfo?: UserOrgInfo;
  constructor(creds: LoginData & { userOrgInfo?: UserOrgInfo }) {
    this.#credentials = creds;
    switch (this.#credentials.type) {
      case "microsoft":
      case "keys":
      case "password":
        break;
      default:
        throw new Error("unrecognised creds type");
    }
    this.#userOrgInfo = creds.userOrgInfo;
  }
  get credentials(): LoginData {
    return this.#credentials;
  }
  get passCredentials() {
    switch (this.#credentials.type) {
      case "microsoft":
        return {
          tokens: this.#credentials.tokens,
          received: this.#credentials.received,
          // TODO: should we need accountId?
          accountId: this.#credentials.account_id
        };
      case "keys":
        return {
          idKey: this.#credentials.id_key,
          secretKey: this.#credentials.secret_key,
          accountId: this.#credentials.customerid,
        };
      case "password":
        return {
          accountId: this.#credentials.account_id,
          username: this.#credentials.username,
          password: this.#credentials.password,
        };
      default:
        throw new Error("unrecognised creds type");
    }
  }
  get type() {
    return this.#credentials.type;
  }
  get id(): string {
    switch (this.#credentials.type) {
      case "microsoft":
        {
          const claims = jose.decodeJwt(this.#credentials.tokens.id_token);
          return `${this.#credentials.type}.${claims.iss}.${claims.sub}`;
        }
      case "keys":
        return `${this.#credentials.type}.${this.#credentials.id_key}`;
      case "password":
        return `${this.#credentials.type}.${this.#credentials.account_id}.${this.#credentials.username}`;
      default:
        throw new Error("unrecognised creds type");
    }
  }
  get accountId(): string {
    switch (this.#credentials.type) {
      case "microsoft":
        return this.#credentials.account_id;
      case "keys":
        return this.#credentials.customerid;
      case "password":
        return this.#credentials.account_id
      default:
        throw new Error("unrecognised creds type");
    }
  }
  get remaining(): number | undefined {
    if (this.#credentials.type === "microsoft") {
      // check if we need to reauthorize
      const now = Math.floor((new Date()).getTime() / 1000);
      this.#credentials.received;
      this.#credentials.tokens.expires_in;
      const expires = this.#credentials.received + this.#credentials.tokens.expires_in;
      const remaining = expires - now;
      return remaining;
    } else {
      return undefined;
    }
  }

  public get cachedUserOrgInfo(): UserOrgInfo | undefined {
    const raw = localStorage.getItem(`${this.id}.userOrgInfo`,);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.log(raw)
        console.error(e);
      }
    }
    return undefined;
  }

  public set cachedUserOrgInfo(org: UserOrgInfo) {
    localStorage.setItem(`${this.id}.userOrgInfo`, JSON.stringify(org));
  }

  async userOrgInfo(): Promise<UserOrgInfo | undefined> {
    if (!this.#userOrgInfo) {
      await this.refreshUserOrgInfo();
    }
    return this.#userOrgInfo;
  }
  async refreshUserOrgInfo() {
    // TODO: there is a risk of introducing an infinite loop here
    const api = new ApiClient(authFromLoginData(this.#credentials), this.accountId);
    this.#userOrgInfo = await api.org() ?? {};
    this.cachedUserOrgInfo = this.#userOrgInfo;
  }
}


export function getGraphClient(accessToken: string) {
  // Initialize Graph client
  const graphClient = Client.init({
    // Use the provided access token to authenticate requests
    authProvider: (done: MsalGraphAuthProviderCallback) => {
      done(null, accessToken);
    },
  });
  return graphClient;
}
