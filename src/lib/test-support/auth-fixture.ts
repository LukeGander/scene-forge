import { randomUUID } from "node:crypto";

export const TEST_BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:4321";

const TEST_PASSWORD = "test-password-123";

export interface TestUser {
  email: string;
  cookie: string;
}

function extractCookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Signs up and signs in a fresh test user (unique email per call) against a
 * running local Astro dev server, returning a session Cookie header ready to
 * attach to subsequent requests via `apiFetch`.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `test-${label}-${randomUUID()}@example.com`;
  const form = new URLSearchParams({ email, password: TEST_PASSWORD });
  const headers = { Origin: TEST_BASE_URL };

  const signUpResponse = await fetch(`${TEST_BASE_URL}/api/auth/signup`, {
    method: "POST",
    body: form,
    headers,
    redirect: "manual",
  });
  if (signUpResponse.headers.get("location") !== "/auth/confirm-email") {
    throw new Error(
      `Signup failed for ${email}: redirected to ${signUpResponse.headers.get("location") ?? "(no location)"}`,
    );
  }

  const signInResponse = await fetch(`${TEST_BASE_URL}/api/auth/signin`, {
    method: "POST",
    body: form,
    headers,
    redirect: "manual",
  });
  if (signInResponse.headers.get("location") !== "/") {
    throw new Error(
      `Signin failed for ${email}: redirected to ${signInResponse.headers.get("location") ?? "(no location)"}`,
    );
  }

  return { email, cookie: extractCookieHeader(signInResponse) };
}

/**
 * `fetch()` against the running dev server, attaching `cookie` when provided
 * (pass `null` to simulate an unauthenticated request). Redirects are left
 * unfollowed so tests can assert on the redirect response itself. Sets
 * `Origin` to `TEST_BASE_URL` on every request — Astro's built-in CSRF
 * protection (`security.checkOrigin`, on by default for `output: "server"`)
 * otherwise rejects same-origin-looking POST/PATCH requests that arrive with
 * no `Origin` header at all, which every plain `fetch()` from Node does.
 */
export async function apiFetch(cookie: string | null, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Origin", TEST_BASE_URL);
  if (cookie) {
    headers.set("Cookie", cookie);
  }

  return fetch(`${TEST_BASE_URL}${path}`, { ...init, headers, redirect: init.redirect ?? "manual" });
}
