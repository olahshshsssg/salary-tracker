const KEYS = {
  categories: "salary-tracker.categories",
  transactions: "salary-tracker.transactions",
  budget: "salary-tracker.budget",
};

const SEED_CATEGORIES = [
  { name: "Зарплата", type: "income" },
  { name: "Подработка", type: "income" },
  { name: "Еда", type: "expense" },
  { name: "Транспорт", type: "expense" },
  { name: "Жильё", type: "expense" },
];

function read(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeed() {
  if (localStorage.getItem(KEYS.categories) === null) {
    write(
      KEYS.categories,
      SEED_CATEGORIES.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        type: item.type,
      })),
    );
  }
  if (localStorage.getItem(KEYS.transactions) === null) {
    write(KEYS.transactions, []);
  }
}

function collection(key) {
  return {
    getAll() {
      ensureSeed();
      return read(key) ?? [];
    },
    getById(id) {
      return this.getAll().find((item) => item.id === id) ?? null;
    },
    create(item) {
      const all = this.getAll();
      const record = { id: crypto.randomUUID(), ...item };
      all.push(record);
      write(key, all);
      return record;
    },
    update(id, patch) {
      const all = this.getAll();
      const index = all.findIndex((item) => item.id === id);
      if (index === -1) return null;
      all[index] = { ...all[index], ...patch, id };
      write(key, all);
      return all[index];
    },
    remove(id) {
      const all = this.getAll();
      const next = all.filter((item) => item.id !== id);
      write(key, next);
      return next.length !== all.length;
    },
  };
}

const categoriesStore = collection(KEYS.categories);
const transactionsStore = collection(KEYS.transactions);

function getBudget() {
  const value = Number(localStorage.getItem(KEYS.budget));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function setBudget(amount) {
  localStorage.setItem(KEYS.budget, String(amount > 0 ? amount : 0));
}

function exportBackup() {
  ensureSeed();
  return {
    version: 1,
    categories: read(KEYS.categories) ?? [],
    transactions: read(KEYS.transactions) ?? [],
    budget: getBudget(),
  };
}

function importBackup(payload) {
  if (!payload || payload.version !== 1) return "Этот файл не является копией трекера.";
  if (!Array.isArray(payload.categories) || !Array.isArray(payload.transactions)) return "В файле нет данных.";
  const categoriesOk = payload.categories.every(
    (item) => item && item.id && item.name && (item.type === "income" || item.type === "expense"),
  );
  const transactionsOk = payload.transactions.every(
    (item) =>
      item &&
      item.id &&
      (item.type === "income" || item.type === "expense") &&
      Number.isInteger(item.amount) &&
      item.amount > 0 &&
      item.categoryId &&
      item.date,
  );
  if (!categoriesOk || !transactionsOk) return "В копии есть некорректные записи.";
  write(KEYS.categories, payload.categories);
  write(KEYS.transactions, payload.transactions);
  setBudget(Number.isInteger(payload.budget) ? payload.budget : 0);
  return "";
}
