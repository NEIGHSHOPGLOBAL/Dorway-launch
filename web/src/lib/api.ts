const BASE = "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string, message?: string) {
    super(message ?? code ?? `Request failed (${status})`);
    this.status = status;
    this.code = code;
  }
}

function readError(body: { error?: unknown; message?: string } | null): { code?: string; message?: string } {
  const err = body?.error;
  if (typeof err === "string") return { code: err, message: body?.message };
  if (err && typeof err === "object") {
    const shaped = err as { code?: unknown; message?: unknown };
    return {
      code: typeof shaped.code === "string" ? shaped.code : undefined,
      message: typeof shaped.message === "string" ? shaped.message : undefined,
    };
  }
  return { message: body?.message };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const parsed = readError(body);
    throw new ApiError(res.status, parsed.code, parsed.message);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined, headers }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
