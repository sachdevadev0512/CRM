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
