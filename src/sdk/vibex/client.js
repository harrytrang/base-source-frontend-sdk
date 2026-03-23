import {
  arrToCsv,
  clean,
  hasFileLikeDeep,
  isFileLike,
  isFormDataLike,
  objectToFormData,
} from "../shared/helpers.js";
import { createHttp } from "../shared/http.js";

function createDynamicModule(basePath, http) {
  return new Proxy(
    {},
    {
      get(_target, rawMethod) {
        const method = String(rawMethod);

        return async (...args) => {
          let path = basePath;
          let last = args[args.length - 1];
          if (last?.filter) last.filter = JSON.stringify(last.filter);
          if (last?.sort) last.sort = JSON.stringify(last.sort);
          const GET_METHODS = ["list", "filter", "search", "count", "paging"];

          if (GET_METHODS.includes(method)) {
            return http.request(`${path}/${method}`, {
              method: "GET",
              query: clean(last),
            });
          }

          const hasBody =
            last &&
            typeof last === "object" &&
            !Array.isArray(last) &&
            !isFileLike(last) &&
            !isFormDataLike(last) &&
            !hasFileLikeDeep(last);

          const body = hasBody ? last : undefined;
          const pathParams = hasBody ? args.slice(0, -1) : args;

          if (pathParams.length)
            path += "/" + pathParams.map(encodeURIComponent).join("/");

          path += "/" + encodeURIComponent(method);

          if (isFormDataLike(body)) {
            return http.request(path, {
              method: "POST",
              body,
            });
          }
          if (isFileLike(body) || hasFileLikeDeep(body)) {
            const fd = objectToFormData(body);
            return http.request(path, {
              method: "POST",
              body: fd,
            });
          }

          if (body) {
            return http.request(path, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          }

          return http.request(path, { method: "GET" });
        };
      },
    },
  );
}

function createEntities(http) {
  return new Proxy(
    {},
    {
      get(_t, entityName) {
        const entity = String(entityName);
        return new Proxy(
          {},
          {
            get(_t2, rawMethod) {
              const method = String(rawMethod);
              return async (...args) => {
                switch (method) {
                  case "list":
                    return http.request(`${entity}`, {
                      method: "GET",
                      query: clean({
                        query: clean({
                          filter: 1,
                          sort: 1,
                          limit: args[0]?.limit,
                          skip: args[0]?.skip,
                          fields: arrToCsv(args[0]?.fields),
                        }),
                      }),
                    });

                  case "paging":
                    return http.request(`${entity}/paging`, {
                      method: "GET",
                      query: clean({
                        page: args[0]?.page,
                        pageSize: args[0]?.pageSize,
                        filter: args[0]?.filter
                          ? JSON.stringify(args[0].filter)
                          : undefined,
                        sort: args[0]?.sort
                          ? JSON.stringify(args[0].sort)
                          : undefined,
                        fields: arrToCsv(args[0]?.fields),
                      }),
                    });

                  case "get":
                    return http.request(
                      `${entity}/${encodeURIComponent(args[0])}/get`,
                      { method: "GET" },
                    );

                  case "create": {
                    const data = args[0];
                    if (isFormDataLike(data)) {
                      return http.request(`${entity}`, {
                        method: "POST",
                        body: data,
                      });
                    }
                    if (isFileLike(data) || hasFileLikeDeep(data)) {
                      const fd = objectToFormData(data);
                      return http.request(`${entity}/create`, {
                        method: "POST",
                        body: fd,
                      });
                    }
                    return http.request(`${entity}/create`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(data),
                    });
                  }

                  case "update": {
                    const id = args[0];
                    const data = args[1];
                    if (isFormDataLike(data)) {
                      return http.request(`${entity}/${id}`, {
                        method: "POST",
                        body: data,
                      });
                    }
                    if (isFileLike(data) || hasFileLikeDeep(data)) {
                      const fd = objectToFormData(data);
                      return http.request(`${entity}/${id}/update`, {
                        method: "POST",
                        body: fd,
                      });
                    }
                    return http.request(`${entity}/${id}/update`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(data),
                    });
                  }

                  case "delete":
                    return http.request(`${entity}/${args[0]}/delete`, {
                      method: "GET",
                    });

                  default:
                    return http.request(`${entity}`, {
                      method: "GET",
                      query: clean(args[0]),
                    });
                }
              };
            },
          },
        );
      },
    },
  );
}

function createIntegrations(http) {
  return new Proxy(
    {},
    {
      get(_t, pkgName) {
        const pkg = String(pkgName);
        return new Proxy(
          {},
          {
            get(_t2, actionName) {
              const action = String(actionName);

              return async (data) => {
                if (isFormDataLike(data)) {
                  return http.request(`integrations/${pkg}/${action}`, {
                    method: "POST",
                    body: data,
                  });
                }

                if (isFileLike(data) || hasFileLikeDeep(data)) {
                  const fd = objectToFormData(data);
                  return http.request(`integrations/${pkg}/${action}`, {
                    method: "POST",
                    body: fd,
                  });
                }

                return http.request(`integrations/${pkg}/${action}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data ?? {}),
                });
              };
            },
          },
        );
      },
    },
  );
}

function createAuth(http, cfg) {
  return new Proxy(
    {},
    {
      get(_t, methodName) {
        const name = String(methodName);

        return async (...args) => {
          switch (name) {
            case "register": {
              const res = await http.request("auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });
              if (res?.data.data.token)
                localStorage.setItem("access_token", res.data.data.token);
              if (res?.data.data.user)
                localStorage.setItem(
                  "user",
                  JSON.stringify(res.data.data.user),
                );
              return res;
            }

            case "login": {
              const payload =
                typeof args[0] === "string"
                  ? { email: args[0], password: args[1] }
                  : args[0];

              const res = await http.request("auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (res?.data?.data?.token)
                localStorage.setItem("access_token", res.data.data.token);
              if (res?.data?.data?.user)
                localStorage.setItem(
                  "user",
                  JSON.stringify(res.data.data.user),
                );
              return res;
            }

            case "me":
              return http.request("auth/me", { method: "GET" });

            case "refresh": {
              const res = await http.request("auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });
              if (res?.data.refresh_token)
                http.setToken(res.data.refresh_token, true);
              return res;
            }

            case "changePassword":
              return http.request("auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });

            case "updateProfile":
              return http.request("auth/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });

            case "verify":
              return http.request("auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });

            case "updateMe":
              return http.request("auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0]),
              });

            case "logout":
              http.setToken(undefined, true);
              if (typeof window !== "undefined") {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                window.location.href = "/";
              }
              return;

            case "setToken":
              return http.setToken(args[0], args[1]);

            default:
              return http.request(`auth/${name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args[0] ?? {}),
              });
          }
        };
      },
    },
  );
}

function createFunctions(http) {
  const invoke = async (functionName, options = {}) => {
    const method = (options.method || "POST").toUpperCase();
    const init = { method };

    if (options.query) {
      init.query = options.query;
    }

    if (options.headers) {
      init.headers = { ...options.headers };
    }

    if (options.body && method !== "GET" && method !== "HEAD") {
      init.headers = {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      };
      init.body = JSON.stringify(options.body);
    }

    return http.request(`functions/${encodeURIComponent(functionName)}`, init);
  };

  return new Proxy(
    { invoke },
    {
      get(target, prop) {
        if (prop in target) return target[prop];

        const fnName = String(prop);
        return async (data, options = {}) => {
          return invoke(fnName, {
            ...options,
            body: data,
          });
        };
      },
    },
  );
}

export function createClient(config) {
  if (!config?.serverUrl) throw new Error("serverUrl is required");

  const http = createHttp(config);
  const httpFunctions = createHttp({
    ...config,
    serverUrl: config.serverUrl.replace(/\/entities\/?$/, ""),
  });

  const client = {
    entities: createEntities(http),
    integrations: createIntegrations(http),
    functions: createFunctions(httpFunctions),
    auth: createAuth(http, config),
    setToken: (t) => http.setToken(t, true),
    getConfig: () => ({ serverUrl: config.serverUrl }),
  };

  return new Proxy(client, {
    get(target, prop) {
      if (prop in target) return target[prop];

      const dyn = createDynamicModule(prop, http);
      target[prop] = dyn;
      return dyn;
    },
  });
}
