export class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, message)
}

export function notFound(what: string): AppError {
  return new AppError(404, what + ' not found')
}

export function conflict(message: string): AppError {
  return new AppError(409, message)
}

export function unauthorized(message = 'unauthorized'): AppError {
  return new AppError(401, message)
}

export function forbidden(message = 'forbidden'): AppError {
  return new AppError(403, message)
}

export function unprocessable(message: string): AppError {
  return new AppError(422, message)
}

export function tooMany(message = 'rate limited'): AppError {
  return new AppError(429, message)
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function toBody(err: unknown): { status: number; error: string } {
  if (isAppError(err)) return { status: err.status, error: err.message }
  return { status: 500, error: err instanceof Error ? err.message : 'internal error' }
}
