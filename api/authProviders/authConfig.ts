import { Configuration, LogLevel } from "@azure/msal-browser";

export const SCOPES = ["User.Read", "email"];

export function createConfig(clientId: string): Promise<Configuration> {
  if (!clientId) {
    throw new Error("no client id");
  }
  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
    },
    system: {
      loggerOptions: {
        loggerCallback(_loglevel: LogLevel, message: string, _containsPii: boolean) {
          console.log(message);
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
      },
    },
  };
  return Promise.resolve(msalConfig);
}
