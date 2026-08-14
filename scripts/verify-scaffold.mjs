import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const root = process.cwd();
const serverPort = 4311;
const clientPort = 4312;
const serverUrl = `http://127.0.0.1:${serverPort}`;
const clientUrl = `http://127.0.0.1:${clientPort}`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function start(command, args, env) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function assertClientBundleHasNoServerSecrets() {
  const files = await readdir(join(root, "apps/client/dist/assets"));
  const javascriptFiles = files.filter((file) => file.endsWith(".js"));
  const contents = await Promise.all(
    javascriptFiles.map((file) => readFile(join(root, "apps/client/dist/assets", file), "utf8")),
  );

  if (contents.some((content) => content.includes("GEMINI_API_KEY") || content.includes("GOOGLE_API_KEY"))) {
    throw new Error("A server-only API key name was found in the client bundle");
  }
}

await run(npmCommand, ["run", "build:client"]);
await assertClientBundleHasNoServerSecrets();

const server = start(npmCommand, ["run", "start", "--workspace", "@community-pulse/server"], {
  PORT: String(serverPort),
  CLIENT_ORIGIN: clientUrl,
});
const client = start(npmCommand, ["run", "preview", "--workspace", "@community-pulse/client", "--", "--host", "127.0.0.1", "--port", String(clientPort)], {});

try {
  const healthResponse = await waitFor(`${serverUrl}/api/health`);
  const health = await healthResponse.json();
  if (health.status !== "ok" || health.queryStatus !== "not_ready") {
    throw new Error("The API health endpoint returned an unexpected response");
  }

  const clientResponse = await waitFor(clientUrl);
  const html = await clientResponse.text();
  if (!html.includes("Community Pulse") || !html.includes("/src/main.tsx") && !html.includes("assets/")) {
    throw new Error("The frontend preview did not serve the Community Pulse app");
  }

  console.log("Scaffold verification passed: API health, frontend preview, and client secret boundary.");
} finally {
  await Promise.all([stop(server), stop(client)]);
}
