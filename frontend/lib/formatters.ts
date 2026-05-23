const _NUM_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const _CURRENCY_FMT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const _DATE_FMT = new Intl.DateTimeFormat("en-US");
const _DATE_CACHE = new Map<string, Intl.DateTimeFormat>();
const _PARSED_DATE_CACHE = new Map<string, Date>();

function _getDateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let fmt = _DATE_CACHE.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", options);
    _DATE_CACHE.set(key, fmt);
  }
  return fmt;
}

function _formatDate(value: any, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "\u2014";
  const d = _parseDate(value);
  if (isNaN(d.getTime())) return String(value);
  return _getDateFormat(options).format(d);
}

function _parseDate(value: any): Date {
  const key = String(value);
  let d = _PARSED_DATE_CACHE.get(key);
  if (!d) {
    d = new Date(value);
    if (!isNaN(d.getTime())) {
      _PARSED_DATE_CACHE.set(key, d);
    }
  }
  return d;
}

export function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined || value === "") return "\u2014";

  const num = typeof value === "number" ? value : Number(value);
  const isNumeric = !isNaN(num);

  if (!format) {
    return isNumeric ? _NUM_FMT.format(num) : String(value);
  }

  switch (format) {
    case "currency":
      return isNumeric ? _CURRENCY_FMT.format(num) : String(value);
    case "percent":
      return isNumeric ? num.toFixed(1) + "%" : String(value);
    case "number":
      return isNumeric ? num.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(value);
    case "decimal_2":
      return isNumeric ? num.toFixed(2) : String(value);
    case "month_year":
      return _formatDate(value, { month: "short", year: "numeric" });
    case "quarter": {
      const d = _parseDate(value);
      if (isNaN(d.getTime())) return String(value);
      return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
    }
    case "year":
      return _formatDate(value, { year: "numeric" });
    case "month_short":
      return _formatDate(value, { month: "short" });
    case "day_month":
      return _formatDate(value, { day: "numeric", month: "short" });
    case "date_short":
      return _formatDate(value, { year: "numeric", month: "2-digit", day: "2-digit" });
    case "date_full":
      return _formatDate(value, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    case "week": {
      const d = _parseDate(value);
      if (isNaN(d.getTime())) return String(value);
      const start = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      return `W${week} ${d.getFullYear()}`;
    }
    case "time":
      return _formatDate(value, { hour: "2-digit", minute: "2-digit" });
    case "datetime":
      return _formatDate(value, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    default:
      return String(value);
  }
}
