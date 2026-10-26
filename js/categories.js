function setCategoryError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function initCategories({ onChange }) {
  const form = document.querySelector("#cat-form");
  const title = document.querySelector("#cat-form-title");
  const error = document.querySelector("#cat-error");
  const listError = document.querySelector("#cat-list-error");
  const list = document.querySelector("#cat-list");
  const cancel = document.querySelector("#cat-cancel");
  let editingId = null;

  function resetForm() {
    editingId = null;
    form.reset();
    title.textContent = "Новая категория";
    cancel.hidden = true;
    setCategoryError(error, "");
  }

  function render() {
    const categories = categoriesStore.getAll().slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
    list.replaceChildren();
    categories.forEach((category) => {
      const item = document.createElement("li");
      item.className = "row";

      const text = document.createElement("div");
      const name = document.createElement("p");
      name.className = "row-title";
      name.textContent = category.name;
      const used = transactionsStore.getAll().filter((item) => item.categoryId === category.id).length;
      const meta = document.createElement("p");
      meta.className = "row-meta";
      const tag = document.createElement("span");
      tag.className = `tag tag-${category.type}`;
      tag.textContent = typeLabel(category.type);
      const mod10 = used % 10;
      const mod100 = used % 100;
      const word =
        mod10 === 1 && mod100 !== 11
          ? "операция"
          : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? "операции"
            : "операций";
      meta.append(tag, document.createTextNode(used ? ` ${used} ${word}` : " Нет операций"));
      text.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "row-side";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn-small";
      edit.textContent = "Изменить";
      edit.addEventListener("click", () => startEdit(category.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-small btn-danger";
      remove.textContent = "Удалить";
      remove.addEventListener("click", () => removeCategory(category.id));
      actions.append(edit, remove);

      item.append(text, actions);
      list.append(item);
    });
  }

  function startEdit(id) {
    const category = categoriesStore.getById(id);
    if (!category) return;
    editingId = id;
    form.elements.name.value = category.name;
    form.elements.type.value = category.type;
    title.textContent = "Изменить категорию";
    cancel.hidden = false;
    setCategoryError(error, "");
    setCategoryError(listError, "");
    form.elements.name.focus();
  }

  function removeCategory(id) {
    const used = transactionsStore.getAll().some((item) => item.categoryId === id);
    if (used) {
      setCategoryError(listError, "Нельзя удалить категорию: на неё есть операции.");
      return;
    }
    const category = categoriesStore.getById(id);
    if (!category) return;
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) return;
    categoriesStore.remove(id);
    if (editingId === id) resetForm();
    setCategoryError(listError, "");
    render();
    onChange();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const type = form.elements.type.value;
    if (!name) {
      setCategoryError(error, "Введите название категории.");
      return;
    }
    const duplicate = categoriesStore.getAll().some(
      (item) =>
        item.id !== editingId &&
        item.type === type &&
        item.name.trim().toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"),
    );
    if (duplicate) {
      setCategoryError(error, "Такая категория этого типа уже есть.");
      return;
    }
    if (editingId) {
      const used = transactionsStore.getAll().some((item) => item.categoryId === editingId);
      const current = categoriesStore.getById(editingId);
      if (used && current && current.type !== type) {
        setCategoryError(error, "Нельзя сменить тип: на категорию есть операции.");
        return;
      }
      categoriesStore.update(editingId, { name, type });
    } else {
      categoriesStore.create({ name, type });
    }
    const wasEdit = Boolean(editingId);
    resetForm();
    setCategoryError(listError, "");
    render();
    onChange();
    showToast(wasEdit ? "Категория обновлена." : "Категория добавлена.");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editingId) resetForm();
  });

  cancel.addEventListener("click", resetForm);
  render();

  return { refresh: render };
}
