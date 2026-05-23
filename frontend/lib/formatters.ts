export function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "number" ? value : Number(value);
  const isNumeric = !isNaN(num);

  if (!format) {
    return isNumeric
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num)
      : String(value);
  }

  switch (format) {
    case "currency":
      return isNumeric
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)
        : String(value);
    case "percent":
      return isNumeric ? num.toFixed(1) + "%" : String(value);
    case "number":
      return isNumeric ? num.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(value);
    case "decimal_2":
      return isNumeric ? num.toFixed(2) : String(value);
    case "month_year":
      return formatDate(value, { month: "short", year: "numeric" });
    case "quarter": {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
    }
    case "year":
      return formatDate(value, { year: "numeric" });
    case "month_short":
      return formatDate(value, { month: "short" });
    case "day_month":
      return formatDate(value, { day: "numeric", month: "short" });
    case "date_short":
      return formatDate(value, { year: "numeric", month: "2-digit", day: "2-digit" });
    case "date_full":
      return formatDate(value, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    case "week": {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      const start = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      return `W${week} ${d.getFullYear()}`;
    }
    case "time":
      return formatDate(value, { hour: "2-digit", minute: "2-digit" });
    case "datetime":
      return formatDate(value, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    default:
      return String(value);
  }
}

function formatDate(value: any, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", options);
}
