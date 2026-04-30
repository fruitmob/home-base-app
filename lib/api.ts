"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/authConstants";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);

    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }

    if (init.body && typeof init.body === "string" && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers,
  });
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}
