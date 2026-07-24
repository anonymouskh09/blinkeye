// Typed error helpers so the popup can branch on failure kind rather than
// parsing message strings.

export type ApiErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "duplicate"
  | "validation"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly data: unknown;

  constructor(kind: ApiErrorKind, message: string, status = 0, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.data = data;
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "duplicate";
  if (status === 422 || status === 400) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "Cannot reach RecruitPro. Check your connection and try again.";
      case "unauthorized":
        return "Your session has expired. Please reconnect the extension.";
      case "forbidden":
        return "You do not have permission to perform this action.";
      case "server":
        return "RecruitPro had a problem saving. Please try again shortly.";
      default:
        return error.message || "Something went wrong.";
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
