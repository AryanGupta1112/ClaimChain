import { spawn } from "node:child_process";

const children = [];

function start(command, args) {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  children.push(child);
  child.on("exit", (code) => {
    children.forEach((other) => other !== child && other.kill());
    process.exit(code || 0);
  });
  return child;
}

const api = start(process.execPath, ["--import", "tsx", "server/index.ts"]);

async function waitForApi() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null)
      throw new Error("ClaimChain API stopped during startup.");
    try {
      const response = await fetch("http://127.0.0.1:3001/api/health");
      if (response.ok) return;
    } catch {
      // The API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("ClaimChain API did not become ready within 20 seconds.");
}

try {
  await waitForApi();
  start(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
  ]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  children.forEach((child) => child.kill());
  process.exit(1);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((child) => child.kill());
    process.exit();
  });
