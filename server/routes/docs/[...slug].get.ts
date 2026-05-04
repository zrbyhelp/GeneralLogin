import { createReadStream, existsSync } from "node:fs";
import { join, normalize, relative } from "node:path";
import {
  createError,
  getRequestURL,
  sendStream,
  setHeader
} from "h3";

function findDocsRoot() {
  const candidates = [
    join(process.cwd(), ".output", "public", "docs"),
    join(process.cwd(), "public", "docs")
  ];

  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

function resolveDocsHtml(pathname: string) {
  const docsRoot = findDocsRoot();
  let slug: string;

  try {
    slug = decodeURIComponent(pathname.replace(/^\/docs\/?/, ""));
  } catch {
    return null;
  }

  slug = slug.replace(/\/+$/, "");
  if (!slug) {
    slug = "index";
  }
  if (slug.includes("\\") || slug.includes("\0")) {
    return null;
  }
  if (slug.endsWith(".html")) {
    slug = slug.slice(0, -5);
  }

  const filePath = normalize(join(docsRoot, `${slug}.html`));
  const relativePath = relative(docsRoot, filePath);
  if (relativePath.startsWith("..") || relativePath.includes("..\\")) {
    return null;
  }

  return filePath;
}

export default defineEventHandler((event) => {
  const filePath = resolveDocsHtml(getRequestURL(event).pathname);

  if (!filePath || !existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: "Docs page not found" });
  }

  setHeader(event, "content-type", "text/html; charset=utf-8");
  return sendStream(event, createReadStream(filePath));
});
