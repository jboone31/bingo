/** A failure with a machine-readable reason and an HTTP status. */
export class ApiError extends Error {
  readonly reason: string;
  readonly status: number;

  constructor(reason: string, status: number) {
    super(reason);
    this.name = "ApiError";
    this.reason = reason;
    this.status = status;
  }
}
