// Issue #60: the password rules are one pure source shared by the server validation
// and the live checklist in every form that sets a password. `customer` is the
// account requirement (10 chars, letter + digit); `admin` requires length only.
export const MIN_PASSWORD_LENGTH = 10;

export type PasswordScope = "customer" | "admin";

// #58 step 3: the rule wording lives in the translation table (`shop.password.rule.*`);
// the rule itself stays the pure key + test the checklist renders a row for.
export interface PasswordRule {
  key: string;
  test: (password: string) => boolean;
}

export function passwordRules(scope: PasswordScope): PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      key: "longEnough",
      test: (password) => password.length >= MIN_PASSWORD_LENGTH,
    },
  ];
  if (scope === "customer") {
    rules.push(
      { key: "hasLetter", test: (password) => /[a-zA-Z]/.test(password) },
      { key: "hasDigit", test: (password) => /\d/.test(password) },
    );
  }
  return rules;
}

export function passwordRuleChecks(
  scope: PasswordScope,
  password: string,
): Record<string, boolean> {
  return Object.fromEntries(
    passwordRules(scope).map((rule) => [rule.key, rule.test(password)]),
  );
}

export function passwordRulesMet(scope: PasswordScope, password: string): boolean {
  return passwordRules(scope).every((rule) => rule.test(password));
}
