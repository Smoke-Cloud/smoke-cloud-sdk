import {
  PresenceProgress,
  toSimpleProgress,
  ApiClient, SubmitStartParams, toTable, Phase, MsalBrowserAuthProvider, KeyAuthProvider
} from "../api/api.ts"
// import { load } from "https://deno.land/std@0.212.0/dotenv/mod.ts";

async function runTest(client: ApiClient, fdsVersion: string, options?: { follow?: boolean }): Promise<PresenceProgress> {
  const chid = `room_fire_${fdsVersion.replaceAll(".", "_")}`;
  const startParams: SubmitStartParams = {
    fds_version: fdsVersion,
    project: "test",
    instance_type: 2,
    chid,
  };

  let firstRun;
  for await (const run of client.runs({ chid })) {
    if (!firstRun || firstRun.open_time === undefined) {
      firstRun = run;
    } else if (run.open_time !== undefined && run.open_time < firstRun.open_time) {
      firstRun = run;
    }
  }
  if (!firstRun) throw new Error("No first run");
  const firstInput = await client.input(firstRun.run_id, Phase.Storage);
  const run = await client.newRun(startParams, firstInput);
  // if (options?.follow) {
  //   await client.follow(run.run_id).pipeTo(Deno.stdout.writable, { preventClose: true });
  // }
  await client.confirmClosed(run.run_id);
  const stored = await client.run(run.run_id);
  // const testDir = "testFiles"
  // await fs.mkdir(testDir, { recursive: true })
  // {
  //   // Retrieve the zip file
  //   const zipFile = await client.zip(run.run_id);
  //   const destination = await createWriteStream(`${testDir}/${chid}.zip`)
  //   zipFile.pipeTo(Writable.toWeb(destination));
  // }
  // {
  //   // Get the progress
  //   const progress = await client.progress(run.run_id);
  // }
  // // TODO: test phase resolution
  // {
  //   // Retrieve the err file as a string
  //   const file = await client.err(run.run_id, Phase.Storage);
  //   await fs.writeFile(`${testDir}/${chid}.err`, file);
  //   // file.pipeTo(Writable.toWeb(destination));
  // }
  // {
  //   // Retrieve the err file as a bytes
  //   const file = await client.errBytes(run.run_id, Phase.Storage);
  //   const destination = await createWriteStream(`${testDir}/${chid}.errb`)
  //   file.stream().pipeTo(Writable.toWeb(destination));
  // }
  // {
  //   // Retrieve the input file as a string
  //   const file = await client.input(run.run_id, Phase.Storage);
  //   await fs.writeFile(`${testDir}/${chid}.fds`, file);
  // }
  // {
  //   // Retrieve the hrr
  //   const file = await client.data(run.run_id, Phase.Storage, "hrr", "HRR");
  //   await fs.writeFile(`${testDir}/${chid}_hrr.json`, JSON.stringify(file, null, 2));
  // }
  // {
  //   // Retrieve the run data
  //   const file = await client.runData(run.run_id);
  //   console.log("runData:", file);
  //   await fs.writeFile(`${testDir}/${chid}_runData.json`, JSON.stringify(file, null, 2));
  // }
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

async function main() {
  try {
    // const env = await load();
    const auth = new MsalBrowserAuthProvider("e28c2818-dde5-4ba5-8bc4-482bfa57846b");
    // const auth = new KeyAuthProvider(env["ID_KEY"], env["SECRET_KEY"]);
    await auth.init();
    const client = new ApiClient(auth);
    await client.init();
    const ps = fdsVersions.map(async (version) => {
      const result = await runTest(client, version);
      const progress = toSimpleProgress(result);
      return { version, ...progress };
    });
    console.log(await client.load());
    // Show the status of the running simulations
    const status = await client.status();
    console.log("Status:");
    console.table(toTable(status));

    const results = (await Promise.allSettled(ps)).map((r) => {
      if (r.status === "fulfilled") {
        return { status: r.status, ...(r.value) };
      } else {
        const reason = r.reason;
        return { status: r.status, reason };
      }
    });
    console.table(results);
  } catch (e) {
    console.error("something went wrong")
    console.error(e)
  }
}

main().then(() => {
  console.log("done");
});
