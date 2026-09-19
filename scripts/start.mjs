import { spawn, spawnSync } from "node:child_process";

for (const args of [
  ["django_auth/manage.py", "migrate", "--noinput"],
  ["django_auth/manage.py", "seed_claimchain"],
]) {
  const result = spawnSync("python", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

const children = [
  spawn("python", ["django_auth/manage.py", "runserver", "127.0.0.1:8000", "--noreload"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { stdio: "inherit", env: process.env }),
];

for (const child of children)
  child.on("exit", (code) => {
    children.forEach((other) => other !== child && other.kill());
    process.exit(code || 0);
  });

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((child) => child.kill());
    process.exit();
  });
