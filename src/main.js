import "./styles.css";

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000/api`;
const app = document.querySelector("#app");

const columns = [
  { key: "todo", title: "Todo / Backlog", tone: "todo" },
  { key: "doing", title: "Doing", tone: "doing" },
  { key: "done", title: "Done", tone: "done" }
];

const emptyForm = {
  title: "",
  description: "",
  status: "todo",
  points: "",
  acceptanceCriteria: ""
};

const state = {
  stories: [],
  loading: true,
  boardMessage: "",
  boardError: false,
  formMode: "create",
  editingId: null,
  formValues: { ...emptyForm },
  formError: "",
  submitting: false,
  statusUpdatingId: null,
  commentDrafts: {},
  commentSubmittingId: null,
  commentErrorByStoryId: {},
  expandedComments: {},
  draggingStoryId: null,
  draggingStatus: null,
  reorderSaving: false,
  modalOpen: false,
  searchQuery: ""
};

renderApp();
bindEvents();
loadStories();

function renderApp() {
  document.body.style.overflow = state.modalOpen ? "hidden" : "";
  app.innerHTML = `
    <div class="app-root">
      <nav class="navbar">
        <div class="navbar-brand">Agile Tracker</div>
        <div class="navbar-mid">
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M13 13l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
              id="search-input"
              type="search"
              class="search-input"
              placeholder="Search stories..."
              value="${escapeAttribute(state.searchQuery)}"
              autocomplete="off"
            />
          </div>
        </div>
        <button class="btn btn-primary" id="new-story-btn" type="button">+ New story</button>
      </nav>

      <main class="board-wrap">
        ${state.boardMessage ? `
          <div class="status-bar${state.boardError ? " status-bar-error" : ""}" role="status">
            ${escapeHtml(state.boardMessage)}
          </div>
        ` : ""}
        <div class="board" aria-label="Kanban board">
          ${renderBoard()}
        </div>
      </main>

      ${state.modalOpen ? renderModal() : ""}
    </div>
  `;
}

function renderModal() {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">
            ${state.formMode === "create" ? "New story" : `Edit story #${state.editingId}`}
          </h2>
          <button class="modal-close-btn" id="modal-close" type="button" aria-label="Close">&#x2715;</button>
        </div>
        <div class="modal-body">
          <form id="story-form" class="form">
            <div class="form-group">
              <label class="form-label" for="f-title">Title</label>
              <input
                id="f-title"
                type="text"
                name="title"
                class="form-input"
                value="${escapeAttribute(state.formValues.title)}"
                placeholder="As a user, I want to..."
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-desc">Description</label>
              <textarea
                id="f-desc"
                name="description"
                class="form-input"
                rows="3"
                placeholder="Describe the story..."
              >${escapeHtml(state.formValues.description)}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="f-status">Status</label>
                <select id="f-status" name="status" class="form-input">
                  ${renderStatusOptions(state.formValues.status)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="f-pts">Points</label>
                <input
                  id="f-pts"
                  type="number"
                  min="0"
                  step="1"
                  name="points"
                  class="form-input"
                  value="${escapeAttribute(state.formValues.points)}"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="f-ac">Acceptance criteria</label>
              <textarea
                id="f-ac"
                name="acceptanceCriteria"
                class="form-input"
                rows="5"
                placeholder="One criterion per line"
                required
              >${escapeHtml(state.formValues.acceptanceCriteria)}</textarea>
              <p class="form-hint">Enter each criterion on a new line.</p>
            </div>
            ${state.formError ? `<p class="form-error">${escapeHtml(state.formError)}</p>` : ""}
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
              <button class="btn btn-primary" type="submit" ${state.submitting ? "disabled" : ""}>
                ${state.submitting ? "Saving..." : state.formMode === "create" ? "Create story" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function renderBoard() {
  return columns
    .map((col) => {
      const allItems = state.stories.filter((s) => s.status === col.key);
      const items = state.searchQuery
        ? allItems.filter((s) =>
            s.title.toLowerCase().includes(state.searchQuery.toLowerCase())
          )
        : allItems;
      const total = allItems.reduce((t, s) => t + s.points, 0);
      const isTodo = col.key === "todo";

      return `
        <div class="column column-${col.tone}" data-column-key="${col.key}">
          <div class="column-header">
            <h2 class="column-title">${col.title}</h2>
            <div class="column-meta">
              <span class="col-chip">${allItems.length} ${allItems.length === 1 ? "story" : "stories"}</span>
              <span class="col-chip col-chip-pts">${total}p</span>
            </div>
          </div>
          <div class="column-body todo-dropzone" data-dropzone="${col.key}">
            ${items.length > 0 ? items.map(renderCard).join("") : renderEmpty()}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCard(story) {
  const acCount = story.acceptanceCriteria.length;
  const cmtCount = story.comments.length;
  const isUpdating = state.statusUpdatingId === story.id;
  const isSubmittingCmt = state.commentSubmittingId === story.id;
  const draft = state.commentDrafts[story.id] || "";
  const cmtError = state.commentErrorByStoryId[story.id] || "";
  const isTodo = story.status === "todo";
  const isExpanded = !!state.expandedComments[story.id];

  return `
    <div class="card" data-story-id="${story.id}">
      <div class="card-top">
        <button
          class="drag-handle"
          type="button"
          draggable="true"
          data-draggable-story="${story.status}"
          data-story-id="${story.id}"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        ><svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.4"/><circle cx="6" cy="2" r="1.4"/>
          <circle cx="2" cy="7" r="1.4"/><circle cx="6" cy="7" r="1.4"/>
          <circle cx="2" cy="12" r="1.4"/><circle cx="6" cy="12" r="1.4"/>
        </svg></button>
        <div class="card-top-right">
          <span class="card-pts">${story.points}p</span>
          <span class="card-id">#${story.id}</span>
        </div>
      </div>
      <h3 class="card-title">${escapeHtml(story.title)}</h3>
      ${story.description ? `<p class="card-desc">${escapeHtml(story.description)}</p>` : ""}
      <div class="card-tags">
        <span class="tag">${acCount} AC</span>
        <button
          class="tag tag-btn"
          type="button"
          data-action="toggle-comments"
          data-story-id="${story.id}"
        >${cmtCount} comment${cmtCount !== 1 ? "s" : ""}${isExpanded ? " &#9652;" : " &#9662;"}</button>
      </div>
      <select
        class="status-select"
        data-action="status-change"
        data-story-id="${story.id}"
        ${isUpdating ? "disabled" : ""}
        aria-label="Change status"
      >
        ${renderStatusOptions(story.status)}
      </select>
      ${
        isExpanded
          ? `<div class="comments-box">
              <div class="comment-list">
                ${
                  cmtCount > 0
                    ? story.comments
                        .map(
                          (c) => `
                        <div class="comment">
                          <p class="comment-text">${escapeHtml(c.text)}</p>
                          <div class="comment-footer">
                            <time class="comment-time">${escapeHtml(c.createdAt)}</time>
                            <button
                              class="comment-delete-btn"
                              type="button"
                              data-action="delete-comment"
                              data-story-id="${story.id}"
                              data-comment-id="${c.id}"
                              aria-label="Delete comment"
                            >&#x2715;</button>
                          </div>
                        </div>`
                        )
                        .join("")
                    : `<p class="comment-empty">No comments yet.</p>`
                }
              </div>
              <form class="cmt-form" data-story-id="${story.id}">
                <textarea
                  name="text"
                  class="form-input"
                  rows="2"
                  placeholder="Add a comment..."
                  ${isSubmittingCmt ? "disabled" : ""}
                >${escapeHtml(draft)}</textarea>
                ${cmtError ? `<p class="form-error-sm">${escapeHtml(cmtError)}</p>` : ""}
                <button class="btn btn-sm btn-secondary" type="submit" ${isSubmittingCmt ? "disabled" : ""}>
                  ${isSubmittingCmt ? "Saving..." : "Add comment"}
                </button>
              </form>
            </div>`
          : ""
      }
      <div class="card-meta">
        <span>Created ${escapeHtml(story.createdAt)}</span>
        ${story.updatedAt !== story.createdAt ? `<span>Updated ${escapeHtml(story.updatedAt)}</span>` : ""}
      </div>
      <div class="card-actions">
        <button class="btn btn-sm btn-ghost" type="button" data-action="edit" data-story-id="${story.id}">Edit</button>
        <button class="btn btn-sm btn-danger" type="button" data-action="delete" data-story-id="${story.id}">Delete</button>
      </div>
    </div>
  `;
}

function renderEmpty() {
  return `<div class="empty-state"><p>No stories here.</p></div>`;
}

function renderStatusOptions(selected) {
  return columns
    .map(
      (col) =>
        `<option value="${col.key}" ${selected === col.key ? "selected" : ""}>${col.title}</option>`
    )
    .join("");
}

function bindEvents() {
  app.addEventListener("click", handleClick);
  app.addEventListener("submit", handleSubmit);
  app.addEventListener("change", handleChange);
  app.addEventListener("input", handleInput);
  app.addEventListener("dragstart", handleDragStart);
  app.addEventListener("dragover", handleDragOver);
  app.addEventListener("drop", handleDrop);
  app.addEventListener("dragend", handleDragEnd);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modalOpen) closeModal();
  });
}

function openModal() {
  state.modalOpen = true;
  renderApp();
  document.getElementById("f-title")?.focus();
}

function closeModal() {
  resetForm(false);
  state.modalOpen = false;
  renderApp();
}

async function loadStories() {
  state.loading = true;
  state.boardMessage = "Loading...";
  state.boardError = false;
  renderApp();

  try {
    const res = await fetch(`${API_BASE}/stories`);
    if (!res.ok) throw new Error("Stories could not be loaded.");
    state.stories = await res.json();
    state.boardMessage = "";
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
  } finally {
    state.loading = false;
    renderApp();
  }
}

function handleInput(event) {
  if (event.target.id !== "search-input") return;
  state.searchQuery = event.target.value;
  const board = document.querySelector(".board");
  if (board) board.innerHTML = renderBoard();
}

function handleClick(event) {
  if (event.target.id === "modal-backdrop") {
    closeModal();
    return;
  }

  const btn = event.target.closest("button");
  if (!btn) return;

  if (btn.id === "new-story-btn") {
    state.formMode = "create";
    state.formValues = { ...emptyForm };
    state.formError = "";
    openModal();
    return;
  }

  if (btn.id === "modal-close" || btn.id === "cancel-edit") {
    closeModal();
    return;
  }

  const storyId = Number(btn.dataset.storyId);

  if (btn.dataset.action === "toggle-comments") {
    state.expandedComments[storyId] = !state.expandedComments[storyId];
    renderApp();
    return;
  }

  if (btn.dataset.action === "edit") {
    startEdit(storyId);
    return;
  }

  if (btn.dataset.action === "delete") {
    deleteStory(storyId);
    return;
  }

  if (btn.dataset.action === "delete-comment") {
    deleteComment(storyId, Number(btn.dataset.commentId));
  }
}

function handleChange(event) {
  const el = event.target;
  if (el.dataset.action !== "status-change") return;
  updateStatus(Number(el.dataset.storyId), el.value);
}

function handleDragStart(event) {
  const handle = event.target.closest("[data-draggable-story]");
  if (!handle || state.reorderSaving) {
    event.preventDefault();
    return;
  }
  const storyId = Number(handle.dataset.storyId);
  const story = state.stories.find((s) => s.id === storyId);
  state.draggingStoryId = storyId;
  state.draggingStatus = story?.status ?? null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(storyId));
  // Defer class so browser captures ghost before opacity changes
  setTimeout(() => {
    document.querySelector(`.card[data-story-id="${storyId}"]`)?.classList.add("card-dragging");
  }, 0);
}

function handleDragOver(event) {
  if (!state.draggingStoryId) return;
  const dropzone = event.target.closest("[data-dropzone]");
  if (!dropzone) return;
  event.preventDefault();

  const isSameColumn = dropzone.dataset.dropzone === state.draggingStatus;
  const card = event.target.closest(".card");
  const isOtherCard = card && Number(card.dataset.storyId) !== state.draggingStoryId;

  if (isSameColumn) {
    clearColumnTarget();
    if (isOtherCard) {
      const rect = card.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      setDragTarget(card, insertAfter);
    } else {
      clearDragTarget();
    }
  } else {
    clearDragTarget();
    setColumnTarget(dropzone);
  }
}

async function handleDrop(event) {
  if (!state.draggingStoryId) return;
  const dropzone = event.target.closest("[data-dropzone]");
  if (!dropzone) return;
  event.preventDefault();
  const draggedId = state.draggingStoryId;
  const dropzoneStatus = dropzone.dataset.dropzone;
  const isSameColumn = dropzoneStatus === state.draggingStatus;

  if (!isSameColumn) {
    await moveToColumn(draggedId, dropzoneStatus);
    return;
  }

  const status = state.draggingStatus;
  const columnIds = state.stories.filter((s) => s.status === status).map((s) => s.id);
  const card = event.target.closest(".card");
  const targetCard =
    card && Number(card.dataset.storyId) !== draggedId ? card : getDragTargetCard();
  const targetId = targetCard ? Number(targetCard.dataset.storyId) : null;

  let next;
  if (!targetId) {
    // Dropped on empty column area — move to end
    next = [...columnIds.filter((id) => id !== draggedId), draggedId];
  } else {
    // Insert before or after target based on cursor position
    const rect = targetCard.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    next = moveStoryId(columnIds, draggedId, targetId, insertAfter);
  }

  if (!hasOrderChanged(columnIds, next)) {
    clearDragState();
    return;
  }
  await saveReorder(next, status);
}

function handleDragEnd() {
  if (state.draggingStoryId) clearDragState();
}

async function handleSubmit(event) {
  if (event.target.id === "story-form") {
    event.preventDefault();
    const fd = new FormData(event.target);
    const payload = {
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      status: String(fd.get("status") || "todo"),
      points: String(fd.get("points") || "").trim(),
      acceptanceCriteria: String(fd.get("acceptanceCriteria") || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    };
    state.formValues = {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      points: payload.points,
      acceptanceCriteria: String(fd.get("acceptanceCriteria") || "")
    };
    state.formError = "";
    state.submitting = true;
    renderApp();

    try {
      const isEdit = state.formMode === "edit";
      const url = isEdit
        ? `${API_BASE}/stories/${state.editingId}`
        : `${API_BASE}/stories`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new Error(body?.error || "Story could not be saved.");
      state.boardMessage = isEdit ? "Story updated." : "Story created.";
      state.boardError = false;
      state.submitting = false;
      closeModal();
      await loadStories();
    } catch (err) {
      state.formError = err.message;
      state.submitting = false;
      renderApp();
    }
    return;
  }

  if (event.target.classList.contains("cmt-form")) {
    event.preventDefault();
    const storyId = Number(event.target.dataset.storyId);
    const fd = new FormData(event.target);
    await addComment(storyId, String(fd.get("text") || ""));
  }
}

async function addComment(storyId, text) {
  state.commentDrafts[storyId] = text;
  state.commentErrorByStoryId[storyId] = "";
  state.commentSubmittingId = storyId;
  renderApp();
  try {
    const res = await fetch(`${API_BASE}/stories/${storyId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || "Comment could not be saved.");
    state.commentDrafts[storyId] = "";
    state.commentErrorByStoryId[storyId] = "";
    state.boardMessage = `Comment added to story #${storyId}.`;
    await loadStories();
  } catch (err) {
    state.commentErrorByStoryId[storyId] = err.message;
    renderApp();
  } finally {
    state.commentSubmittingId = null;
    renderApp();
  }
}

async function deleteComment(storyId, commentId) {
  try {
    const res = await fetch(`${API_BASE}/stories/${storyId}/comments/${commentId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body?.error || "Comment could not be deleted.");
    }
    await loadStories();
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
    renderApp();
  }
}

function startEdit(storyId) {
  const story = state.stories.find((s) => s.id === storyId);
  if (!story) return;
  state.formMode = "edit";
  state.editingId = story.id;
  state.formError = "";
  state.formValues = {
    title: story.title,
    description: story.description || "",
    status: story.status,
    points: String(story.points),
    acceptanceCriteria: story.acceptanceCriteria.join("\n")
  };
  openModal();
}

async function deleteStory(storyId) {
  const story = state.stories.find((s) => s.id === storyId);
  if (!story || !window.confirm(`Delete story #${storyId}?`)) return;
  state.boardMessage = `Deleting story #${storyId}...`;
  state.boardError = false;
  renderApp();
  try {
    const res = await fetch(`${API_BASE}/stories/${storyId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body?.error || "Story could not be deleted.");
    }
    state.boardMessage = `Story #${storyId} deleted.`;
    await loadStories();
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
    renderApp();
  }
}

async function updateStatus(storyId, nextStatus) {
  const story = state.stories.find((s) => s.id === storyId);
  if (!story || story.status === nextStatus) return;
  state.statusUpdatingId = storyId;
  renderApp();
  try {
    const res = await fetch(`${API_BASE}/stories/${storyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || "Status could not be updated.");
    state.boardMessage = `Story #${storyId} moved to ${getStatusLabel(nextStatus)}.`;
    await loadStories();
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
    renderApp();
  } finally {
    state.statusUpdatingId = null;
    renderApp();
  }
}

async function moveToColumn(storyId, newStatus) {
  state.boardMessage = `Moving story...`;
  state.boardError = false;
  clearDragState(false);
  renderApp();
  try {
    const res = await fetch(`${API_BASE}/stories/${storyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || "Story could not be moved.");
    state.boardMessage = `Story moved to ${getStatusLabel(newStatus)}.`;
    await loadStories();
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
    renderApp();
  }
}

async function saveReorder(storyIds, status = "todo") {
  state.reorderSaving = true;
  state.boardMessage = "Saving order...";
  renderApp();
  try {
    const res = await fetch(`${API_BASE}/stories/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyIds, status })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || "Order could not be saved.");
    state.boardMessage = "Order saved.";
    clearDragState(false);
    await loadStories();
  } catch (err) {
    state.boardMessage = err.message;
    state.boardError = true;
    clearDragState(false);
    renderApp();
  } finally {
    state.reorderSaving = false;
    renderApp();
  }
}

function resetForm(shouldRender = true) {
  state.formMode = "create";
  state.editingId = null;
  state.formError = "";
  state.submitting = false;
  state.formValues = { ...emptyForm };
  if (shouldRender) renderApp();
}

function getStatusLabel(status) {
  return columns.find((col) => col.key === status)?.title || status;
}

function moveStoryId(ids, draggedId, targetId, insertAfter = false) {
  const filtered = ids.filter((id) => id !== draggedId);
  const to = filtered.indexOf(targetId);
  if (to === -1) return ids;
  filtered.splice(insertAfter ? to + 1 : to, 0, draggedId);
  return filtered;
}

function hasOrderChanged(curr, next) {
  return curr.some((id, i) => id !== next[i]);
}

function clearDragState(shouldRender = true) {
  document
    .querySelector(`.card[data-story-id="${state.draggingStoryId}"]`)
    ?.classList.remove("card-dragging");
  clearDragTarget();
  clearColumnTarget();
  state.draggingStoryId = null;
  state.draggingStatus = null;
  if (shouldRender) renderApp();
}

function setColumnTarget(dropzone) {
  const current = document.querySelector(".column-body-drag-over");
  if (current === dropzone) return;
  current?.classList.remove("column-body-drag-over");
  dropzone.classList.add("column-body-drag-over");
}

function clearColumnTarget() {
  document.querySelector(".column-body-drag-over")?.classList.remove("column-body-drag-over");
}

function setDragTarget(card, insertAfter = false) {
  const wantClass = insertAfter ? "card-drag-after" : "card-drag-before";
  const otherClass = insertAfter ? "card-drag-before" : "card-drag-after";
  const current = getDragTargetCard();
  if (current === card && card.classList.contains(wantClass)) return;
  current?.classList.remove("card-drag-before", "card-drag-after");
  card.classList.remove(otherClass);
  card.classList.add(wantClass);
}

function clearDragTarget() {
  getDragTargetCard()?.classList.remove("card-drag-before", "card-drag-after");
}

function getDragTargetCard() {
  return document.querySelector(".card-drag-before, .card-drag-after");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
