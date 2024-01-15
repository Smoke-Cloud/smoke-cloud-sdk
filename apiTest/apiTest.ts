import { load } from "https://deno.land/std@0.212.0/dotenv/mod.ts";
import { ApiClient, SubmitStartParams, toTable } from "../api/api.ts";
import {
  PresenceProgress,
  toSimpleProgress,
} from "../api/coreTypes.ts";
import { KeyAuthProvider } from "../api/authProviders/mod.ts";
const env = await load();


// {
//   const testClient = new ApiClient(new MsalAuthProvider(env["SMOKE_CLOUD_CLIENT_ID"]), env["ACCOUNT_ID"]);
// }
// {
//   const testClient = new ApiClient(new KeyAuthProvider(env["ID_KEY"], env["SECRET_KEY"]), env["ACCOUNT_ID"]);
// }
// {
//   const testClient = new ApiClient(new PasswordAuthProvider(env["ACCOUNT_ID"], env["USERNAME"], env["PASSWORD"]), env["ACCOUNT_ID"]);
// }

async function runTest(client: ApiClient, fdsVersion: string, options?: { follow?: boolean }): Promise<PresenceProgress> {
  const chid = `room_fire_${fdsVersion.replaceAll(".", "_")}`;
  const startParams: SubmitStartParams = {
    fds_version: fdsVersion,
    project: "test",
    instance_type: 2,
    chid,
  };
  // TODO: get input from first run
  const input: Deno.FsFile = await Deno.open(
    `../smoke-cloud-testing/${chid}/${chid}.fds`,
  );
  const run = await client.newRun(startParams, input.readable);
  if (options?.follow) {
    await client.follow(run.run_id).pipeTo(Deno.stdout.writable, { preventClose: true });
  }
  await client.confirmClosed(run.run_id);
  const stored = await client.run(run.run_id);
  return stored.stored;
}

const fdsVersions = [
  "5.5.3",
  "6.1.2",
  "6.2.0",
  "6.3.0",
  "6.3.1",
  "6.3.2",
  "6.4.0",
  "6.5.0",
  "6.5.1",
  "6.5.2",
  "6.5.3",
  "6.6.0",
  "6.7.0",
  "6.7.1",
  "6.7.3",
  "6.7.4",
  "6.7.5",
  "6.7.6",
  "6.7.7",
  "6.7.8",
  "6.7.9",
  "6.8.0",
];

if (import.meta.main) {
  const client = new ApiClient(new KeyAuthProvider(env["ID_KEY"], env["SECRET_KEY"]), env["ACCOUNT_ID"]);
  const ps = fdsVersions.map(async (version) => {
    const result = await runTest(client, version);
    const progress = toSimpleProgress(result);
    return { version, ...progress };
  });

  // Show the status of the running simulations
  const status = await client.status();
  console.log("Status:");
  console.table(toTable(status));

  const results = await Promise.all(ps);
  console.table(results);
}
