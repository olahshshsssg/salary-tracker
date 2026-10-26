function setTransactionError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function parseAmount(raw) {
  const cleaned = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}

function initTransactions({ onChange }) {
  const form = document.querySelector("#tx-form");
  const title = document.querySelector("#tx-form-title");
  const error = document.querySelector("#tx-error");
  const list = document.querySelector("#tx-list");
  const empty = document.querySelector("#tx-empty");
  const cancel = document.querySelector("#tx-cancel");
  const typeFilter = document.querySelector("#tx-filter-type");
  const categoryFilter = document.querySelector("#tx-filter-category");
  const search = document.querySelector("#tx-search");
  const sortSelect = document.querySelector("#tx-sort");
  const count = document.querySelector("#tx-count");
  let editingId = null;

  form.elements.date.value = todayISO();

  function fillCategorySelect(select, type, selectedId, includeAll) {
    const previous = selectedId ?? select.value;
    select.replaceChildren();
    if (includeAll) {
      const all = document.createElement("option");
      all.value = "all";
      all.textContent = "Все";
      select.append(all);
    }
    const categories = categoriesStore
      .getAll()
      .filter((item) => !type || type === "all" || item.type === type)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = includeAll ? `${category.name} · ${typeLabel(category.type)}` : category.name;
      select.append(option);
    });
    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  function refreshCategoryOptions() {
    fillCategorySelect(form.elements.categoryId, form.elements.type.value, form.elements.categoryId.value, false);
    const filterType = typeFilter.value;
    fillCategorySelect(categoryFilter, filterType, categoryFilter.value, true);
  }

  function resetForm() {
    editingId = null;
    form.reset();
    form.elements.date.value = todayISO();
    title.textContent = "Новая операция";
    cancel.hidden = true;
    setTransactionError(error, "");
    refreshCategoryOptions();
  }

  function render() {
    refreshCategoryOptions();
    const type = typeFilter.value;
    const categoryId = categoryFilter.value;
    const query = search.value.trim().toLocaleLowerCase("ru");
    const categories = new Map(categoriesStore.getAll().map((item) => [item.id, item]));
    const items = transactionsStore
      .getAll()
      .filter((item) => type === "all" || item.type === type)
      .filter((item) => categoryId === "all" || item.categoryId === categoryId)
      .filter((item) => {
        if (!query) return true;
        const name = categories.get(item.categoryId)?.name ?? "";
        return (
          name.toLocaleLowerCase("ru").includes(query) || (item.note ?? "").toLocaleLowerCase("ru").includes(query)
        );
      })
      .sort((a, b) => {
        if (sortSelect.value === "date-asc") return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
        if (sortSelect.value === "amount-desc") return b.amount - a.amount || b.date.localeCompare(a.date);
        if (sortSelect.value === "amount-asc") return a.amount - b.amount || b.date.localeCompare(a.date);
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      });

    list.replaceChildren();
    count.textContent = `Показано ${items.length}`;
    empty.hidden = items.length > 0;
    items.forEach((item) => {
      const category = categories.get(item.categoryId);
      const row = document.createElement("li");
      row.className = "row";

      const text = document.createElement("div");
      const heading = document.createElement("p");
      heading.className = "row-title";
      heading.textContent = category?.name ?? "Без категории";
      const meta = document.createElement("p");
      meta.className = "row-meta";
      const tag = document.createElement("span");
      tag.className = `tag tag-${item.type}`;
      tag.textContent = typeLabel(item.type);
      meta.append(tag, document.createTextNode(`${formatDate(item.date)}${item.note ? ` · ${item.note}` : ""}`));
      text.append(heading, meta);

      const side = document.createElement("div");
      side.className = "row-side";
      const money = document.createElement("span");
      money.className = item.type === "income" ? "money-income" : "money-expense";
      money.textContent = formatMoney(item.amount);
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn-small";
      edit.textContent = "Изменить";
      edit.addEventListener("click", () => startEdit(item.id));
      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = "btn-small";
      duplicate.textContent = "Копия";
      duplicate.addEventListener("click", () => duplicateTransaction(item.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-small btn-danger";
      remove.textContent = "Удалить";
      remove.addEventListener("click", () => removeTransaction(item.id));
      side.append(money, edit, duplicate, remove);
      row.append(text, side);
      list.append(row);
    });
  }

  function startEdit(id) {
    const item = transactionsStore.getById(id);
    if (!item) return;
    editingId = id;
    form.elements.type.value = item.type;
    form.elements.amount.value = String(item.amount);
    form.elements.date.value = item.date;
    form.elements.note.value = item.note ?? "";
    fillCategorySelect(form.elements.categoryId, item.type, item.categoryId, false);
    title.textContent = "Изменить операцию";
    cancel.hidden = false;
    setTransactionError(error, "");
    form.elements.amount.focus();
  }

  function duplicateTransaction(id) {
    const item = transactionsStore.getById(id);
    if (!item) return;
    transactionsStore.create({
      type: item.type,
      amount: item.amount,
      categoryId: item.categoryId,
      date: item.date,
      note: item.note ?? "",
    });
    showToast("Операция скопирована.");
    render();
    onChange();
  }

  function removeTransaction(id) {
    if (!window.confirm("Удалить операцию?")) return;
    transactionsStore.remove(id);
    if (editingId === id) resetForm();
    render();
    onChange();
  }

  form.elements.type.addEventListener("change", () => {
    fillCategorySelect(form.elements.categoryId, form.elements.type.value, "", false);
  });

  typeFilter.addEventListener("change", () => {
    categoryFilter.value = "all";
    render();
  });
  categoryFilter.addEventListener("change", render);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const type = form.elements.type.value;
    const amount = parseAmount(form.elements.amount.value);
    const categoryId = form.elements.categoryId.value;
    const date = form.elements.date.value;
    const note = form.elements.note.value.trim();
    const category = categoriesStore.getById(categoryId);

    if (amount === null) {
      setTransactionError(error, "Сумма должна быть целым числом больше нуля.");
      return;
    }
    if (!date) {
      setTransactionError(error, "Укажите дату.");
      return;
    }
    if (!category || category.type !== type) {
      setTransactionError(error, "Выберите категорию того же типа, что и операция.");
      return;
    }

    const payload = { type, amount, categoryId, date, note };
    const wasEdit = Boolean(editingId);
    if (editingId) transactionsStore.update(editingId, payload);
    else transactionsStore.create(payload);
    resetForm();
    render();
    onChange();
    showToast(wasEdit ? "Операция обновлена." : "Операция добавлена.");
  });

  cancel.addEventListener("click", resetForm);
  search.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editingId) resetForm();
  });
  render();

  return { refresh: render };
}
