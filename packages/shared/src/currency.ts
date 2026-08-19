/**
 * Centralized currency-symbol lookup for Middha Ventures Investment CRM.
 *
 * Every amount column (target_raise, valuations, previous-round figures, revenue, burn, etc.)
 * is stored alongside a `currency` code (INR/USD/EUR) the applicant picks once on the public
 * form -- every place that renders one of those amounts must look up the symbol from that same
 * row's `currency`, never hardcode one. This used to be three separate copies of the same
 * switch statement (public form, admin pipeline board/table, startup detail drawer), and the
 * admin copies drifted: the table hardcoded "$" for every deal, then a later "fix" hardcoded
 * "₹" for every deal instead -- both wrong for any deal not actually in that currency. One
 * shared function means there's only one place left to get it wrong.
 */
export function getCurrencySymbol(currency?: string | null): string {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    default: return '₹';
  }
}

/**
 * Formats an amount for display with a FIXED digit grouping, regardless of the currency symbol
 * shown next to it or the locale of the machine viewing the page.
 *
 * `.toLocaleString()` with no locale argument silently falls back to whatever locale the
 * viewer's browser/OS is set to -- so the exact same ₹12,00,00,000 (Indian lakh/crore grouping)
 * on one admin's laptop rendered as ₹120,000,000 (Western thousands grouping) on another's, with
 * no difference in the underlying data at all. Pinning the locale here means every viewer sees
 * the identical string for the identical number, no matter their machine's settings.
 *
 * INR uses the Indian lakh/crore grouping (en-IN) since that's the convention this fund and its
 * applicants actually use; USD/EUR use the conventional thousands grouping (en-US).
 */
export function formatAmount(value?: number | null, currency?: string | null): string {
  const locale = currency === 'USD' || currency === 'EUR' ? 'en-US' : 'en-IN';
  return (value ?? 0).toLocaleString(locale);
}
