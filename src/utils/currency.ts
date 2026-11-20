// Currency & number formatting for BDT

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(num: number | string): string {
  return num.toString().replace(/\d/g, (d) => BENGALI_DIGITS[parseInt(d, 10)]);
}

/**
 * Format integer BDT amount.
 * Examples:
 * formatBDT(1500, 'en') -> "৳1,500"
 * formatBDT(1500, 'bn') -> "৳১,৫০০"
 */
export function formatBDT(amount: number | undefined | null, lang: 'bn' | 'en' = 'bn'): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return lang === 'bn' ? '৳০' : '৳0';
  }

  const intAmount = Math.round(amount);
  const formattedEn = new Intl.NumberFormat('en-IN').format(intAmount);

  if (lang === 'bn') {
    return `৳${toBengaliNumber(formattedEn)}`;
  }

  return `৳${formattedEn}`;
}

/**
 * Parse input string or number to safe integer BDT
 */
export function parseBDT(value: string | number): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.round(value));
  }
  const clean = value.replace(/[^0-9]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}
