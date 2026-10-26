const panels = {
  dashboard: document.querySelector("#view-dashboard"),
  transactions: document.querySelector("#view-transactions"),
  categories: document.querySelector("#view-categories"),
};

const dashboard = initDashboard();
let transactions;
const categories = initCategories({
  onChange() {
    transactions.refresh();
    dashboard.refresh();
  },
});
transactions = initTransactions({
  onChange() {
    categories.refresh();
    dashboard.refresh();
  },
});

function refreshAll() {
  categories.refresh();
  transactions.refresh();
  dashboard.refresh();
}

document.querySelector("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `finansy-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Копия скачана.");
});

document.querySelector("#import-data").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const message = importBackup(JSON.parse(String(reader.result)));
      if (message) {
        showToast(message);
        return;
      }
      refreshAll();
      showToast("Копия загружена.");
    } catch {
      showToast("Не удалось прочитать файл.");
    }
  };
  reader.readAsText(file);
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    document.querySelectorAll(".tab").forEach((button) => {
      const active = button === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    Object.entries(panels).forEach(([name, panel]) => {
      panel.hidden = name !== view;
    });
    if (view === "dashboard") dashboard.refresh();
  });
});
