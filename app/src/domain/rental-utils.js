export const buildEventDateTime = (date, time) => {
  const value = new Date(`${date}T${time}:00-03:00`);
  if (!Number.isFinite(value.getTime())) {
    throw new Error("Invalid event date or time");
  }
  return value;
};

export const buildEventRange = (date, startTime, endTime) => {
  const startAt = buildEventDateTime(date, startTime);
  const endAt = buildEventDateTime(date, endTime);
  if (endAt <= startAt) endAt.setUTCDate(endAt.getUTCDate() + 1);
  return { startAt, endAt };
};

export const moneyToCents = (value) => {
  const text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let normalized = text;

  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? text.replaceAll(".", "").replace(",", ".")
      : text.replaceAll(",", "");
  } else if (comma >= 0) {
    normalized = text.replaceAll(".", "").replace(",", ".");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

export const buildRentalItems = (products, selectedUnitIds) => {
  const selected = new Set(selectedUnitIds.map(Number));
  return products.flatMap((product) => {
    const productUnitIds = product.units
      .filter((unit) => selected.has(unit.id))
      .map((unit) => unit.id);
    return productUnitIds.length
      ? [{
          productId: product.id,
          quantity: productUnitIds.length,
          productUnitIds,
          unitPriceCents: 0,
        }]
      : [];
  });
};

export const formatCurrency = (amountCents = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);

export const formatEventDate = (value, options = {}) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    ...options,
  }).format(new Date(value));

export const toLocalDateKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const getCalendarDays = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return {
      date,
      key: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      currentMonth: date.getUTCMonth() === monthNumber - 1,
    };
  });
};
