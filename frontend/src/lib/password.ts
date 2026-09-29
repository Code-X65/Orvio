export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  hasMinLength: boolean;
  hasMixedCase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 12;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumber) score += 1;
  if (hasSpecial) score += 1;

  if (password.length < 8 && score > 1) {
    score = 1;
  }

  const levels: Record<number, { label: PasswordStrength['label']; color: string }> = {
    0: { label: 'Very weak', color: 'bg-slate-700' },
    1: { label: 'Weak', color: 'bg-red-500' },
    2: { label: 'Fair', color: 'bg-amber-500' },
    3: { label: 'Good', color: 'bg-blue-500' },
    4: { label: 'Strong', color: 'bg-emerald-500' },
  };

  return {
    score,
    label: levels[score].label,
    color: levels[score].color,
    hasMinLength,
    hasMixedCase,
    hasNumber,
    hasSpecial,
  };
}
