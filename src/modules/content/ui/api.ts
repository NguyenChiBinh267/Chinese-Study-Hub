import { applicationRequest } from "@/modules/auth/ui/protected-fetch";
export class ApplicationRequestError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "http"
      | "network"
      | "timeout"
      | "aborted"
      | "invalid-response",
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApplicationRequestError";
  }
}
// Same-origin BFF; the server independently verifies identity.
export async function localRequest<T>(
  path: string,
  input?: unknown,
  key?: string,
  signal?: AbortSignal,
): Promise<T> {
  const deadline = AbortSignal.timeout(15000);
  let receivedStatus: number | null = null;
  let r: Response;
  let text: string;
  try {
    r = await applicationRequest(path, {
      method: input === undefined ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      signal: signal ? AbortSignal.any([deadline, signal]) : deadline,
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
    receivedStatus = r.status;
    text = await r.text();
  } catch (e) {
    if (receivedStatus !== null && receivedStatus >= 400)
      throw new ApplicationRequestError(
        `HTTP ${receivedStatus} · Chưa đọc đủ phản hồi lỗi từ server; chưa nhận được kết quả. Bạn có thể thử lại.`,
        "http",
        receivedStatus,
      );
    if (signal?.aborted)
      throw new ApplicationRequestError(
        "Yêu cầu đọc đã được hủy; chưa nhận được kết quả.",
        "aborted",
        receivedStatus,
      );
    if (deadline.aborted || (e instanceof Error && e.name === "TimeoutError"))
      throw new ApplicationRequestError(
        "Đã hết thời gian chờ server; chưa nhận được kết quả. Bạn có thể thử lại.",
        "timeout",
        receivedStatus,
      );
    if (e instanceof Error && e.name === "AbortError")
      throw new ApplicationRequestError(
        "Yêu cầu đọc đã được hủy; chưa nhận được kết quả.",
        "aborted",
        receivedStatus,
      );
    // Authentication/application exceptions keep their existing handling.
    if (!(e instanceof TypeError)) throw e;
    throw new ApplicationRequestError(
      "Không kết nối được với server; chưa nhận được kết quả. Kiểm tra kết nối rồi thử lại.",
      "network",
      receivedStatus,
    );
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    if (!r.ok)
      throw new ApplicationRequestError(
        `Server báo lỗi HTTP ${r.status}; chưa nhận được kết quả. Bạn có thể thử lại.`,
        "http",
        r.status,
      );
    throw new ApplicationRequestError(
      `Server chưa trả JSON hợp lệ (HTTP ${r.status}); chưa xác nhận lưu.`,
      "invalid-response",
      r.status,
    );
  }
  if (!r.ok)
    throw new ApplicationRequestError(
      `HTTP ${r.status} · ${typeof value?.error?.message === "string" ? value.error.message : "Chưa nhận được kết quả từ server."}`,
      "http",
      r.status,
      typeof value?.error?.code === "string" ? value.error.code : null,
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
