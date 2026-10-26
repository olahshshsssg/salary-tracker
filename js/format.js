const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function formatMoney(amount) {
  const value = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat("ru-RU")
    .format(Math.abs(value))
    .replace(/\u00A0/g, " ");
  const sign = value < 0 ? "−" : "";
  return `${sign}${formatted} сум`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function todayISO() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${name} ${year}`;
}

function typeLabel(type) {
  return type === "income" ? "Доход" : "Расход";
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}
