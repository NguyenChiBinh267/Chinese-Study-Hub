import { applicationRequest } from "@/modules/auth/ui/protected-fetch";
// Same-origin BFF; the server independently verifies identity.
export async function localRequest<T>(
  path: string,
  input?: unknown,
  key?: string,
): Promise<T> {
  const r = await applicationRequest(path, {
    method: input === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
    headers:
      input === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "x-csh-local": "1",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const text = await r.text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      `Server chưa trả JSON hợp lệ (HTTP ${r.status}); chưa xác nhận lưu.`,
    );
  }
  if (!r.ok)
    throw new Error(
      value.error?.message ?? `Chưa xác nhận từ server (HTTP ${r.status}).`,
    );
  return value as T;
}

export function contentApi<T>(
  path: string,
  input?: unknown,
  key?: string,
): Promise<T> {
  return localRequest<T>(`/content${path}`, input, key);
}
