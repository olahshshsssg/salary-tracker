const PALETTE = ["#1f7a4d", "#d4533a", "#e0a106", "#2f6f8f", "#6b4c9a", "#c46b2c", "#3d8b74", "#a33b4a", "#5c6b3a", "#4d5d73"];
const BAR_DEPTH = 16;

function shade(hex, amount) {
  const value = String(hex).replace("#", "");
  const channels = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  const mixed = channels.map((channel) => {
    const next = amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const bar3d = {
  id: "bar3d",
  beforeDatasetDraw(chart, args) {
    const meta = args.meta;
    if (meta.type !== "bar" || meta.hidden) return;
    const color = chart.data.datasets[args.index].backgroundColor;
    if (typeof color !== "string") return;
    const { ctx } = chart;
    const dx = BAR_DEPTH;
    const dy = BAR_DEPTH * 0.62;
    meta.data.forEach((bar) => {
      const top = Math.min(bar.y, bar.base);
      const bottom = Math.max(bar.y, bar.base);
      if (bottom - top < 2) return;
      const left = bar.x - bar.width / 2;
      const right = bar.x + bar.width / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(right, top);
      ctx.lineTo(right + dx, top - dy);
      ctx.lineTo(right + dx, bottom - dy);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.fillStyle = shade(color, -0.32);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right + dx, top - dy);
      ctx.lineTo(left + dx, top - dy);
      ctx.closePath();
      ctx.fillStyle = shade(color, 0.38);
      ctx.fill();
      ctx.restore();
    });
  },
};

const pie3d = {
  id: "pie3d",
  beforeDatasetDraw(chart, args) {
    const meta = args.meta;
    if (meta.type !== "doughnut" || meta.hidden) return;
    const colors = chart.data.datasets[args.index].backgroundColor;
    const { ctx } = chart;
    const depth = 12;
    for (let layer = depth; layer >= 1; layer -= 1) {
      meta.data.forEach((arc, index) => {
        const color = Array.isArray(colors) ? colors[index] : colors;
        if (!color || arc.circumference < 0.001) return;
        ctx.save();
        ctx.translate(0, layer);
        ctx.beginPath();
        ctx.arc(arc.x, arc.y, arc.outerRadius, arc.startAngle, arc.endAngle);
        ctx.arc(arc.x, arc.y, arc.innerRadius, arc.endAngle, arc.startAngle, true);
        ctx.closePath();
        ctx.fillStyle = shade(color, -0.38);
        ctx.fill();
        ctx.restore();
      });
    }
  },
};

Chart.register(bar3d, pie3d);

function periodBounds(period, fromValue, toValue) {
  const now = new Date();
  if (period === "all") return null;
  if (period === "custom") {
    if (!fromValue || !toValue) return { start: null, end: null, invalid: true };
    let start = new Date(`${fromValue}T00:00:00`);
    let end = new Date(`${toValue}T00:00:00`);
    if (start > end) [start, end] = [end, start];
    return { start, end };
  }
  if (period === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  if (period === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function previousBounds(bounds) {
  if (!bounds || !bounds.start || !bounds.end) return null;
  const length = bounds.end.getTime() - bounds.start.getTime();
  const end = new Date(bounds.start);
  end.setDate(end.getDate() - 1);
  return { start: new Date(end.getTime() - length), end };
}

function inBounds(dateStr, bounds) {
  if (!bounds) return true;
  if (bounds.invalid) return false;
  const date = new Date(`${dateStr}T00:00:00`);
  return date >= bounds.start && date <= bounds.end;
}

function currentMonthBounds() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function monthKeysBetween(dates) {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const [startYear, startMonth] = sorted[0].slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = sorted[sorted.length - 1].slice(0, 7).split("-").map(Number);
  const keys = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

function sumByType(items, type) {
  return items.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount, 0);
}

function writeDelta(el, current, previous, higherIsGood) {
  if (previous === null) {
    el.textContent = "";
    el.className = "delta";
    return;
  }
  const diff = current - previous;
  const direction = diff === 0 ? "" : diff > 0 ? "delta-up" : "delta-down";
  const tone = diff === 0 ? "" : (diff > 0) === higherIsGood ? "delta-good" : "delta-bad";
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  el.textContent = diff === 0 ? "Как в прошлом периоде" : `${sign}${formatMoney(Math.abs(diff))} к прошлому периоду`;
  el.className = `delta ${direction} ${tone}`.trim();
}

function initDashboard() {
  const periodSelect = document.querySelector("#period");
  const rangeFromField = document.querySelector("#range-from-field");
  const rangeToField = document.querySelector("#range-to-field");
  const rangeFrom = document.querySelector("#range-from");
  const rangeTo = document.querySelector("#range-to");
  const incomeEl = document.querySelector("#total-income");
  const expenseEl = document.querySelector("#total-expense");
  const balanceEl = document.querySelector("#total-balance");
  const incomeDelta = document.querySelector("#income-delta");
  const expenseDelta = document.querySelector("#expense-delta");
  const balanceDelta = document.querySelector("#balance-delta");
  const statCount = document.querySelector("#stat-count");
  const statAvg = document.querySelector("#stat-avg");
  const statTop = document.querySelector("#stat-top");
  const budgetForm = document.querySelector("#budget-form");
  const budgetInput = document.querySelector("#budget-input");
  const budgetBar = document.querySelector("#budget-bar");
  const budgetLabel = document.querySelector("#budget-label");
  const recentList = document.querySelector("#recent-list");
  const emptyRecent = document.querySelector("#empty-recent");
  const charts = { months: null, expense: null, income: null };

  rangeFrom.value = `${todayISO().slice(0, 8)}01`;
  rangeTo.value = todayISO();

  function setChart(key, canvasId, emptyId, config) {
    const canvas = document.querySelector(`#${canvasId}`);
    const empty = document.querySelector(`#${emptyId}`);
    charts[key]?.destroy();
    charts[key] = null;
    const hasData = config !== null;
    canvas.parentElement.classList.toggle("is-hidden", !hasData);
    empty.hidden = hasData;
    if (!hasData) return;
    charts[key] = new Chart(canvas, config);
  }

  function render() {
    const period = periodSelect.value;
    const custom = period === "custom";
    rangeFromField.hidden = !custom;
    rangeToField.hidden = !custom;
    const bounds = periodBounds(period, rangeFrom.value, rangeTo.value);
    const before = previousBounds(bounds);
    const categories = new Map(categoriesStore.getAll().map((item) => [item.id, item]));
    const all = transactionsStore.getAll();
    const items = all.filter((item) => inBounds(item.date, bounds));
    const previousItems = before ? all.filter((item) => inBounds(item.date, before)) : [];
    const income = sumByType(items, "income");
    const expense = sumByType(items, "expense");
    const balance = income - expense;
    const previousIncome = before ? sumByType(previousItems, "income") : null;
    const previousExpense = before ? sumByType(previousItems, "expense") : null;
    const previousBalance = before ? previousIncome - previousExpense : null;

    incomeEl.textContent = formatMoney(income);
    expenseEl.textContent = formatMoney(expense);
    balanceEl.textContent = formatMoney(balance);
    balanceEl.classList.toggle("is-positive", balance > 0);
    balanceEl.classList.toggle("is-negative", balance < 0);
    writeDelta(incomeDelta, income, previousIncome, true);
    writeDelta(expenseDelta, expense, previousExpense, false);
    writeDelta(balanceDelta, balance, previousBalance, true);

    const expenseItems = items.filter((item) => item.type === "expense");
    statCount.textContent = String(items.length);
    statAvg.textContent = expenseItems.length ? formatMoney(Math.round(expense / expenseItems.length)) : "0 сум";
    const byCategory = new Map();
    expenseItems.forEach((item) => {
      const name = categories.get(item.categoryId)?.name ?? "Без категории";
      byCategory.set(name, (byCategory.get(name) ?? 0) + item.amount);
    });
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    statTop.textContent = top ? `${top[0]} · ${formatMoney(top[1])}` : "—";

    const monthExpenses = sumByType(all.filter((item) => inBounds(item.date, currentMonthBounds())), "expense");
    const budget = getBudget();
    budgetInput.value = budget ? String(budget) : "";
    if (!budget) {
      budgetBar.style.width = "0%";
      budgetBar.className = "";
      budgetLabel.textContent = "Лимит не задан";
    } else {
      const ratio = Math.min(100, Math.round((monthExpenses / budget) * 100));
      budgetBar.style.width = `${ratio}%`;
      budgetBar.className = monthExpenses > budget ? "is-over" : "";
      budgetLabel.textContent =
        monthExpenses > budget
          ? `Превышение на ${formatMoney(monthExpenses - budget)} · ${formatMoney(monthExpenses)} из ${formatMoney(budget)}`
          : `Осталось ${formatMoney(budget - monthExpenses)} · ${formatMoney(monthExpenses)} из ${formatMoney(budget)}`;
    }

    const byMonth = new Map();
    items.forEach((item) => {
      const key = item.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, { income: 0, expense: 0 });
      byMonth.get(key)[item.type] += item.amount;
    });
    const months = monthKeysBetween(items.map((item) => item.date));
    setChart(
      "months",
      "chart-months",
      "empty-months",
      months.length
        ? {
            type: "bar",
            data: {
              labels: months.map(formatMonthLabel),
              datasets: [
                {
                  label: "Доход",
                  data: months.map((key) => byMonth.get(key)?.income ?? 0),
                  backgroundColor: "#1f7a4d",
                  borderSkipped: false,
                },
                {
                  label: "Расход",
                  data: months.map((key) => byMonth.get(key)?.expense ?? 0),
                  backgroundColor: "#d4533a",
                  borderSkipped: false,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              clip: false,
              layout: { padding: { top: 22, right: 28 } },
              datasets: { bar: { barPercentage: 0.72, categoryPercentage: 0.7 } },
              plugins: { legend: { position: "bottom" } },
              scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatMoney(value) } } },
            },
          }
        : null,
    );

    ["expense", "income"].forEach((type) => {
      const totals = new Map();
      items
        .filter((item) => item.type === type)
        .forEach((item) => {
          const name = categories.get(item.categoryId)?.name ?? "Без категории";
          totals.set(name, (totals.get(name) ?? 0) + item.amount);
        });
      const labels = [...totals.keys()];
      setChart(
        type,
        type === "expense" ? "chart-expense" : "chart-income",
        type === "expense" ? "empty-expense" : "empty-income",
        labels.length
          ? {
              type: "doughnut",
              data: {
                labels,
                datasets: [
                  {
                    data: labels.map((label) => totals.get(label)),
                    backgroundColor: labels.map((_, index) => PALETTE[index % PALETTE.length]),
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                clip: false,
                layout: { padding: { bottom: 8, top: 4 } },
                plugins: { legend: { position: "bottom", labels: { padding: 18 } } },
              },
            }
          : null,
      );
    });

    const recent = transactionsStore
      .getAll()
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 5);
    recentList.replaceChildren();
    emptyRecent.hidden = recent.length > 0;
    recent.forEach((item) => {
      const row = document.createElement("li");
      row.className = "row";
      const text = document.createElement("div");
      const heading = document.createElement("p");
      heading.className = "row-title";
      heading.textContent = categories.get(item.categoryId)?.name ?? "Без категории";
      const meta = document.createElement("p");
      meta.className = "row-meta";
      const tag = document.createElement("span");
      tag.className = `tag tag-${item.type}`;
      tag.textContent = typeLabel(item.type);
      meta.append(tag, document.createTextNode(formatDate(item.date)));
      text.append(heading, meta);
      const money = document.createElement("span");
      money.className = item.type === "income" ? "money-income" : "money-expense";
      money.textContent = formatMoney(item.amount);
      row.append(text, money);
      recentList.append(row);
    });
  }

  periodSelect.addEventListener("change", render);
  rangeFrom.addEventListener("change", render);
  rangeTo.addEventListener("change", render);
  budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseAmount(budgetInput.value);
    if (budgetInput.value.trim() && amount === null) {
      showToast("Лимит должен быть целым числом больше нуля.");
      return;
    }
    setBudget(amount ?? 0);
    showToast(amount ? "Лимит сохранён." : "Лимит снят.");
    render();
  });
  render();
  return { refresh: render };
}
