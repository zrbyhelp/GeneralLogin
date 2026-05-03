import type { H3Event } from "h3";
import { getQuery } from "h3";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export function getQueryString(query: Record<string, string | string[]>, key: string) {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

export function parseAdminListQuery(event: H3Event, defaultPageSize = DEFAULT_PAGE_SIZE) {
  const query = getQuery(event) as Record<string, string | string[]>;
  const page = Math.max(1, Number.parseInt(getQueryString(query, "page"), 10) || 1);
  const rawPageSize =
    Number.parseInt(getQueryString(query, "pageSize"), 10) || defaultPageSize;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

  return {
    query,
    keyword: getQueryString(query, "q"),
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

export function parseBooleanFilter(value: string) {
  if (["1", "true", "enabled"].includes(value)) {
    return true;
  }
  if (["0", "false", "disabled"].includes(value)) {
    return false;
  }

  return undefined;
}
