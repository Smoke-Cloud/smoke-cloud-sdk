import { Configuration, LogLevel } from "@azure/msal-node";
// import {
//   DataProtectionScope,
//   FilePersistenceWithDataProtection,
//   // NativeBrokerPlugin,
//   PersistenceCachePlugin,
// } from "@azure/msal-node-extensions";

export async function createConfig(clientId: string): Promise<Configuration> {
  // const cachePath = "./auth_cache";
  // const dataProtectionScope = DataProtectionScope.CurrentUser;
  // const optionalEntropy = ""; //specifies password or other additional entropy used to encrypt the data.
  // const windowsPersistence = await FilePersistenceWithDataProtection.create(
  //   cachePath,
  //   dataProtectionScope,
  //   optionalEntropy,
  // );

  if (!clientId) {
    throw new Error("no client id");
  }
  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
    },
    // cache: {
    //   cachePlugin: new PersistenceCachePlugin(windowsPersistence),
    // },
    // broker: {
    //     nativeBrokerPlugin: new NativeBrokerPlugin()
    // },
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
  return msalConfig;
}
