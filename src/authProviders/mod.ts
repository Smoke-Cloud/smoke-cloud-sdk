export { PasswordAuthProvider } from "./password.ts";
export { KeyAuthProvider } from "./key.ts";
export { TokenAuthProvider } from "./token.ts";

export interface AuthProvider {
  init: () => Promise<void>;
  acquireToken: () => Promise<string>;
}
