import nodemailer from "nodemailer";

export class MailDeliveryError extends Error {}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendAuthCode(input: {
  email: string;
  displayName: string;
  code: string;
  type: "verification" | "reset";
}) {
  const purpose =
    input.type === "verification" ? "verify your email" : "reset your password";
  const subject =
    input.type === "verification"
      ? "Verify your ClaimChain account"
      : "Reset your ClaimChain password";
  const text = `Hello ${input.displayName},\n\nUse code ${input.code} to ${purpose}. The code expires shortly and can be used once.\n\nIf you did not request this, ignore this message.\n\nClaimChain`;

  if (!smtpConfigured()) {
    console.info(`[ClaimChain development mail] ${subject} for ${input.email}`);
    return { delivery: "console" as const };
  }

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      connectionTimeout: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: input.email,
      subject,
      text,
    });
    return { delivery: "smtp" as const };
  } catch {
    throw new MailDeliveryError(
      "The email could not be delivered. Try again shortly.",
    );
  }
}
