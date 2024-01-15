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
    const r = (await response.json()) as { jwt: string };
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
}
