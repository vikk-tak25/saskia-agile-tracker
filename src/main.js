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
  boardMessage: "Loading stories...",
  boardError: false,
  formMode: "create",
  editingId: null,
  formValues: { ...emptyForm },
  formError: "",
  submitting: false,
  statusUpdatingId: null
};

renderApp();
bindEvents();
loadStories();

function renderApp() {
  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div>
          <p class="eyebrow">TAK25 Agile Tracker</p>
          <h1>Story board</h1>
          <p class="app-subtitle">Create, update and delete project stories directly from the Kanban board.</p>
        </div>
        <div class="header-actions">
          <button class="secondary-button" type="button" id="reset-form">New story</button>
          <button class="refresh-button" type="button" id="refresh-board">Refresh</button>
        </div>
      </header>

      <section class="workspace">
        <aside class="editor-panel">
          <div class="panel-card">
            <div class="panel-heading">
              <p class="panel-label">${state.formMode === "create" ? "Create" : "Edit"}</p>
              <h2>${state.formMode === "create" ? "Add a story" : `Edit story #${state.editingId}`}</h2>
            </div>
            <form id="story-form" class="story-form">
              <label>
                <span>Title</span>
                <input type="text" name="title" value="${escapeAttribute(state.formValues.title)}" required />
              </label>
              <label>
                <span>Description</span>
                <textarea name="description" rows="4">${escapeHtml(state.formValues.description)}</textarea>
              </label>
              <div class="form-row">
                <label>
                  <span>Status</span>
                  <select name="status">
                    ${renderStatusOptions(state.formValues.status)}
                  </select>
                </label>
                <label>
                  <span>Points</span>
                  <input type="number" min="0" step="1" name="points" value="${escapeAttribute(state.formValues.points)}" required />
                </label>
              </div>
              <label>
                <span>Acceptance criteria</span>
                <textarea name="acceptanceCriteria" rows="6" placeholder="One criterion per line" required>${escapeHtml(state.formValues.acceptanceCriteria)}</textarea>
              </label>
              ${state.formError ? `<p class="form-error">${escapeHtml(state.formError)}</p>` : ""}
              <div class="form-actions">
                <button class="primary-button" type="submit" ${state.submitting ? "disabled" : ""}>
                  ${state.submitting ? "Saving..." : state.formMode === "create" ? "Create story" : "Save changes"}
                </button>
                ${
                  state.formMode === "edit"
                    ? '<button class="secondary-button" type="button" id="cancel-edit">Cancel</button>'
                    : ""
                }
              </div>
            </form>
          </div>
        </aside>

        <section class="board-panel">
          <section class="board-status${state.boardError ? " board-status-error" : ""}" id="board-status" aria-live="polite">
            ${escapeHtml(state.boardMessage)}
          </section>
          <section class="board-grid" aria-label="Kanban board">
            ${renderBoard()}
          </section>
        </section>
      </section>
    </main>
  `;
}

function renderBoard() {
  return columns
    .map((column) => {
      const items = state.stories.filter((story) => story.status === column.key);
      const pointsTotal = items.reduce((total, story) => total + story.points, 0);

      return `
        <section class="board-column board-column-${column.tone}">
          <header class="column-header">
            <div>
              <h2>${column.title}</h2>
              <p>${items.length} stories</p>
            </div>
            <span class="column-total">${pointsTotal} pts</span>
          </header>
          <div class="column-cards">
            ${items.length > 0 ? items.map(renderStoryCard).join("") : renderEmptyState(column.title)}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderStoryCard(story) {
  const acceptanceCount = story.acceptanceCriteria.length;
  const commentsCount = story.comments.length;
  const isStatusUpdating = state.statusUpdatingId === story.id;

  return `
    <article class="story-card" data-story-id="${story.id}">
      <div class="story-card-top">
        <span class="story-id">#${story.id}</span>
        <span class="story-points">${story.points} pts</span>
      </div>
      <h3>${escapeHtml(story.title)}</h3>
      <p class="story-description">${escapeHtml(story.description || "No description added.")}</p>
      <dl class="story-meta">
        <div>
          <dt>Criteria</dt>
          <dd>${acceptanceCount}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>${commentsCount}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>${story.priority ?? "-"}</dd>
        </div>
      </dl>
      <label class="status-control">
        <span>Status</span>
        <select data-action="status-change" data-story-id="${story.id}" ${isStatusUpdating ? "disabled" : ""}>
          ${renderStatusOptions(story.status)}
        </select>
      </label>
      <div class="story-actions">
        <button class="secondary-button story-action" type="button" data-action="edit" data-story-id="${story.id}">Edit</button>
        <button class="danger-button story-action" type="button" data-action="delete" data-story-id="${story.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderEmptyState(title) {
  return `
    <div class="empty-state">
      <p>No stories in ${title}.</p>
    </div>
  `;
}

function renderStatusOptions(selectedStatus) {
  return columns
    .map(
      (column) =>
        `<option value="${column.key}" ${selectedStatus === column.key ? "selected" : ""}>${column.title}</option>`
    )
    .join("");
}

function bindEvents() {
  app.addEventListener("click", handleClick);
  app.addEventListener("submit", handleSubmit);
  app.addEventListener("change", handleChange);
}

async function loadStories() {
  state.loading = true;
  state.boardMessage = "Loading stories...";
  state.boardError = false;
  renderApp();

  try {
    const response = await fetch(`${API_BASE}/stories`);

    if (!response.ok) {
      throw new Error("Stories could not be loaded.");
    }

    state.stories = await response.json();
    state.boardMessage = `${state.stories.length} stories loaded from the API.`;
  } catch (error) {
    state.boardMessage = error.message;
    state.boardError = true;
  } finally {
    state.loading = false;
    renderApp();
  }
}

function handleClick(event) {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  if (button.id === "refresh-board") {
    loadStories();
    return;
  }

  if (button.id === "reset-form" || button.id === "cancel-edit") {
    resetForm();
    return;
  }

  const storyId = Number(button.dataset.storyId);

  if (button.dataset.action === "edit") {
    startEdit(storyId);
  }

  if (button.dataset.action === "delete") {
    deleteStory(storyId);
  }
}

function handleChange(event) {
  const element = event.target;

  if (element.dataset.action !== "status-change") {
    return;
  }

  const storyId = Number(element.dataset.storyId);
  const nextStatus = element.value;
  updateStatus(storyId, nextStatus);
}

async function handleSubmit(event) {
  if (event.target.id !== "story-form") {
    return;
  }

  event.preventDefault();

  const formData = new FormData(event.target);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    status: String(formData.get("status") || "todo"),
    points: String(formData.get("points") || "").trim(),
    acceptanceCriteria: String(formData.get("acceptanceCriteria") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };

  state.formValues = {
    title: payload.title,
    description: payload.description,
    status: payload.status,
    points: payload.points,
    acceptanceCriteria: String(formData.get("acceptanceCriteria") || "")
  };
  state.formError = "";
  state.submitting = true;
  renderApp();

  try {
    const isEdit = state.formMode === "edit";
    const endpoint = isEdit ? `${API_BASE}/stories/${state.editingId}` : `${API_BASE}/stories`;
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = response.status === 204 ? null : await response.json();

    if (!response.ok) {
      throw new Error(body?.error || "Story could not be saved.");
    }

    state.boardMessage = isEdit ? "Story updated." : "Story created.";
    state.boardError = false;
    resetForm(false);
    await loadStories();
  } catch (error) {
    state.formError = error.message;
    renderApp();
  } finally {
    state.submitting = false;
    renderApp();
  }
}

function startEdit(storyId) {
  const story = state.stories.find((item) => item.id === storyId);

  if (!story) {
    return;
  }

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

  renderApp();
  document.querySelector('input[name="title"]')?.focus();
}

async function deleteStory(storyId) {
  const story = state.stories.find((item) => item.id === storyId);

  if (!story || !window.confirm(`Delete story #${storyId}?`)) {
    return;
  }

  state.boardMessage = `Deleting story #${storyId}...`;
  state.boardError = false;
  renderApp();

  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.error || "Story could not be deleted.");
    }

    if (state.editingId === storyId) {
      resetForm(false);
    }

    state.boardMessage = `Story #${storyId} deleted.`;
    await loadStories();
  } catch (error) {
    state.boardMessage = error.message;
    state.boardError = true;
    renderApp();
  }
}

async function updateStatus(storyId, nextStatus) {
  const story = state.stories.find((item) => item.id === storyId);

  if (!story || story.status === nextStatus) {
    return;
  }

  state.statusUpdatingId = storyId;
  state.boardMessage = `Updating status for story #${storyId}...`;
  state.boardError = false;
  renderApp();

  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: nextStatus })
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error || "Status could not be updated.");
    }

    state.boardMessage = `Story #${storyId} moved to ${getStatusLabel(nextStatus)}.`;
    await loadStories();
  } catch (error) {
    state.boardMessage = error.message;
    state.boardError = true;
    renderApp();
  } finally {
    state.statusUpdatingId = null;
    renderApp();
  }
}

function resetForm(shouldRender = true) {
  state.formMode = "create";
  state.editingId = null;
  state.formError = "";
  state.submitting = false;
  state.formValues = { ...emptyForm };

  if (shouldRender) {
    renderApp();
  }
}

function getStatusLabel(status) {
  return columns.find((column) => column.key === status)?.title || status;
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
