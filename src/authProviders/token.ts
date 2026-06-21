export class TokenAuthProvider {
  #token: string;
  constructor(token: string) {
    this.#token = token;
  }
  async init() {
  }

  async acquireToken(): Promise<string> {
    return this.#token;
  }
}
