export class AuthorizationError extends Error {
  readonly code = "forbidden" as const;

  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly code = "unauthenticated" as const;

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class SeparationOfDutiesError extends AuthorizationError {
  constructor(message = "You cannot approve a request you created.") {
    super(message);
    this.name = "SeparationOfDutiesError";
  }
}
