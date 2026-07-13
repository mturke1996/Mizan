export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordChecks {
  hasMinimumLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    hasMinimumLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLetter: /\p{L}/u.test(password),
    hasNumber: /\p{N}/u.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}
