import "dotenv/config";
import { createApp } from "./app.js";
const host = process.env.HOST || "127.0.0.1";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  (!process.env.ACCESS_PASSWORD ||
    process.env.ACCESS_PASSWORD.length < 12 ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32)
) {
  throw new Error(
    "Non-loopback hosting requires ACCESS_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters).",
  );
}
const { app, db } = createApp();
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, host, () =>
  console.log(`ClaimChain API: http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
