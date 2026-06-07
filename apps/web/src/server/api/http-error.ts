export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code:
      | "BAD_REQUEST"
      | "NOT_FOUND"
      | "CONFLICT"
      | "RATE_LIMITED"
      | "VALIDATION_ERROR",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
