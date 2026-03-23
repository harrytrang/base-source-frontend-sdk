export function ensureBase(url) {
  return url.endsWith("/") ? url : url + "/";
}

export function arrToCsv(v) {
  return !v ? undefined : Array.isArray(v) ? v.join(",") : v;
}

export function clean(o) {
  const c = { ...o };
  Object.keys(c).forEach((k) => c[k] === undefined && delete c[k]);
  return c;
}

export function isFileLike(v) {
  return (
    (typeof File !== "undefined" && v instanceof File) ||
    (typeof Blob !== "undefined" && v instanceof Blob)
  );
}

export function isFormDataLike(v) {
  return typeof FormData !== "undefined" && v instanceof FormData;
}

export function hasFileLikeDeep(v) {
  if (!v || typeof v !== "object") return false;
  if (isFormDataLike(v) || isFileLike(v)) return true;
  if (Array.isArray(v)) return v.some(hasFileLikeDeep);
  for (const val of Object.values(v)) if (hasFileLikeDeep(val)) return true;
  return false;
}

export function objectToFormData(obj, form = new FormData(), ns) {
  if (obj == null) return form;

  if (isFileLike(obj)) {
    form.append(ns || "file", obj);
    return form;
  }

  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const key = ns ? `${ns}[${i}]` : String(i);
      if (isFileLike(v)) form.append(key, v);
      else if (typeof v === "object" && v !== null)
        objectToFormData(v, form, key);
      else form.append(key, v == null ? "" : String(v));
    });
    return form;
  }

  if (typeof obj === "object") {
    Object.entries(obj).forEach(([k, v]) => {
      const key = ns ? `${ns}[${k}]` : k;
      if (v == null) return;
      if (isFileLike(v)) form.append(key, v);
      else if (typeof v === "object") objectToFormData(v, form, key);
      else form.append(key, String(v));
    });
    return form;
  }

  form.append(ns || "value", String(obj));
  return form;
}
