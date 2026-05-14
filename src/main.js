import "./styles.css";

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000/api`;
const app = document.querySelector("#app");

const columns = [
  { key: "todo", title: "Todo / Backlog", tone: "todo" },
  { key: "doing", title: "Doing", tone: "doing" },
  { key: "done", title: "Done", tone: "done" }
];

renderShell();
loadStories();

function renderShell() {
  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div>
          <p class="eyebrow">TAK25 Agile Tracker</p>
          <h1>Story board</h1>
          <p class="app-subtitle">Stories are loaded from the REST API and grouped by workflow state.</p>
        </div>
        <button class="refresh-button" type="button" id="refresh-board">Refresh</button>
      </header>
      <section class="board-status" id="board-status" aria-live="polite">Loading stories...</section>
      <section class="board-grid" id="board-grid" aria-label="Kanban board"></section>
    </main>
  `;

  document
    .querySelector("#refresh-board")
    .addEventListener("click", () => loadStories());
}

async function loadStories() {
  const status = document.querySelector("#board-status");
  const grid = document.querySelector("#board-grid");

  status.textContent = "Loading stories...";
  status.className = "board-status";
  grid.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/stories`);

    if (!response.ok) {
      throw new Error("Stories could not be loaded.");
    }

    const stories = await response.json();
    renderBoard(stories);
    status.textContent = `${stories.length} stories loaded from the API.`;
  } catch (error) {
    status.textContent = error.message;
    status.className = "board-status board-status-error";
  }
}

function renderBoard(stories) {
  const grid = document.querySelector("#board-grid");

  grid.innerHTML = columns
    .map((column) => {
      const items = stories.filter((story) => story.status === column.key);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

