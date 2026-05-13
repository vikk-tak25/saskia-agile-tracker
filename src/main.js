import "./styles.css";

document.querySelector("#app").innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>Agile Tracker</h1>
      <p>Kanban board for managing agile project stories.</p>
    </header>
    <section class="placeholder-board" aria-label="Kanban board preview">
      <article>
        <h2>Todo / Backlog</h2>
        <p>Stories will appear here.</p>
      </article>
      <article>
        <h2>Doing</h2>
        <p>Work in progress will appear here.</p>
      </article>
      <article>
        <h2>Done</h2>
        <p>Completed stories will appear here.</p>
      </article>
    </section>
  </main>
`;

