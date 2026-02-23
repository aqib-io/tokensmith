export class TokenSmithError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TokenSmithError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidTokenError extends TokenSmithError {
  override readonly code = 'INVALID_TOKEN';

  constructor(message: string) {
    super(message, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a token is expired. Not thrown by TokenSmith internally —
 * available for consumers to throw in custom refresh handlers or storage
 * adapters when they detect an expired token.
 */
export class TokenExpiredError extends TokenSmithError {
  override readonly code = 'TOKEN_EXPIRED';

  constructor(message: string) {
    super(message, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RefreshFailedError extends TokenSmithError {
  override readonly code = 'REFRESH_FAILED';
  readonly attempts: number;

  constructor(message: string, attempts: number) {
    super(message, 'REFRESH_FAILED');
    this.name = 'RefreshFailedError';
    this.attempts = attempts;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StorageError extends TokenSmithError {
  override readonly code = 'STORAGE_ERROR';

  constructor(message: string) {
    super(message, 'STORAGE_ERROR');
    this.name = 'StorageError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends TokenSmithError {
  override readonly code = 'NETWORK_ERROR';

  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
