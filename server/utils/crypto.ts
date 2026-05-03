import { createHash, randomBytes } from "node:crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url;
}

export function sameUrlWithoutSearch(left: string, right: string) {
  const a = normalizeUrl(left);
  const b = normalizeUrl(right);
  return a.origin === b.origin && a.pathname === b.pathname;
}
