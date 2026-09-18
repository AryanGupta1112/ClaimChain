import "dotenv/config";
import { createApp } from "./app.js";
const host = process.env.HOST || "127.0.0.1";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  (!process.env.AUTH_BOOTSTRAP_PASSWORD ||
    process.env.AUTH_BOOTSTRAP_PASSWORD.length < 12 ||
    process.env.AUTH_COOKIE_SECURE !== "true" ||
    !process.env.APP_ORIGIN)
) {
  throw new Error(
    "Non-loopback hosting requires AUTH_BOOTSTRAP_PASSWORD (12+ characters), AUTH_COOKIE_SECURE=true, and APP_ORIGIN.",
  );
}
const { app, db, simulation } = createApp();
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, host, () =>
  console.log(`ClaimChain API: http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      simulation.stop();
      db.close();
      process.exit(0);
    }),
  );
