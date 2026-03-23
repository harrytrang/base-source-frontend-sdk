import { ensureBase } from "./helpers.js";

export function createHttp(cfg) {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const storageKey = "access_token";
  let token =
    cfg.token ??
    (typeof window !== "undefined"
      ? (localStorage.getItem(storageKey) ?? undefined)
      : undefined);

  const setToken = (t, save) => {
    token = t;
    if (typeof window !== "undefined" && save) {
      if (t) localStorage.setItem(storageKey, t);
      else localStorage.removeItem(storageKey);
    }
  };

  const buildUrl = (path, q) => {
    const u = new URL(path, ensureBase(cfg.serverUrl));
    if (q)
      Object.entries(q).forEach(
        ([k, v]) => v != null && u.searchParams.append(k, String(v)),
      );
    return u.toString();
  };

  const request = async (path, init = {}) => {
    const url = buildUrl(path, init.query);
    const currentToken =
      typeof window !== "undefined"
        ? (localStorage.getItem(storageKey) ?? token)
        : token;
    let res;
    try {
      res = await fetchImpl(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers || {}),
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
      });
    } catch {
      return undefined;
    }

    if (res.status === 204) return undefined;

    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    let data = text;
    const looksJson =
      ct.includes("application/json") ||
      ct.includes("application/problem+json");

    if (looksJson) {
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {}
    }

    if (res.status === 401 || res.status === 403) {
      console.warn(`[vibexClient SDK] Unauthorized (${res.status})`);

      try {
        token = undefined;
        if (typeof window !== "undefined") {
          if (!path.includes("auth/login") && !path.includes("auth/register")) {
            window.location.href = "/";
          }
        }
      } catch (e) {}

      throw {
        name: "vibexClientError",
        message: "Unauthorized",
        status: res.status,
        data,
      };
    }

    if (!res.ok) {
      throw {
        name: "vibexClientError",
        message: data?.message || data?.title || "Request failed",
        status: data?.status ?? res.status,
        data,
      };
    }

    return looksJson ? data : text;
  };

  return { request, setToken, getConfig: () => ({ serverUrl: cfg.serverUrl }) };
}
