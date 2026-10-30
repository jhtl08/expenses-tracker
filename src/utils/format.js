const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value) {
  const amount = Number(value);

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCompactMoney(value) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount);

  if (absolute >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}m`;
  }

  if (absolute >= 1_000) {
    return `₱${(amount / 1_000).toFixed(1)}k`;
  }

  return `₱${Math.round(amount)}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value) || 0);
}

export function formatPercent(value, digits = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(digits)}%`;
}
