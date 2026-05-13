import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "..", "data", "stories.json");
const STATUSES = ["todo", "doing", "done"];

export async function readStories() {
  const content = await readFile(DATA_FILE, "utf8");
  return sortStories(JSON.parse(content));
}

export async function saveStories(stories) {
  await writeFile(DATA_FILE, `${JSON.stringify(sortStories(stories), null, 2)}\n`);
}

export function findStory(stories, id) {
  return stories.find((story) => story.id === Number(id));
}

export function createStory(stories, payload) {
  const data = validateStoryPayload(payload);
  const now = formatDateTime();
  const nextId = Math.max(0, ...stories.map((story) => story.id)) + 1;
  const story = {
    id: nextId,
    ...data,
    priority: data.status === "todo" ? nextTodoPriority(stories) : null,
    comments: [],
    createdAt: now,
    updatedAt: now
  };

  return story;
}

export function updateStory(stories, id, payload) {
  const existing = findStory(stories, id);

  if (!existing) {
    return null;
  }

  const data = validateStoryPayload(payload);
  const wasTodo = existing.status === "todo";
  const nextPriority = getNextPriority(stories, existing, data.status, wasTodo);

  return {
    ...existing,
    ...data,
    priority: nextPriority,
    comments: existing.comments,
    createdAt: existing.createdAt,
    updatedAt: formatDateTime()
  };
}

export function updateStoryStatus(stories, id, status) {
  if (!STATUSES.includes(status)) {
    throw validationError("Status must be one of: todo, doing, done.");
  }

  const existing = findStory(stories, id);

  if (!existing) {
    return null;
  }

  const nextPriority = getNextPriority(stories, existing, status, existing.status === "todo");

  return {
    ...existing,
    status,
    priority: nextPriority,
    updatedAt: formatDateTime()
  };
}

export function reorderTodoStories(stories, orderedIds) {
  if (!Array.isArray(orderedIds)) {
    throw validationError("storyIds must be an array.");
  }

  const todoIds = stories
    .filter((story) => story.status === "todo")
    .map((story) => story.id)
    .sort((a, b) => a - b);
  const requestedIds = orderedIds.map(Number).sort((a, b) => a - b);

  if (
    todoIds.length !== requestedIds.length ||
    todoIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw validationError("storyIds must include every todo story exactly once.");
  }

  const priorityById = new Map(orderedIds.map((id, index) => [Number(id), index + 1]));

  return sortStories(stories.map((story) => {
    if (story.status !== "todo") {
      return story;
    }

    return {
      ...story,
      priority: priorityById.get(story.id),
      updatedAt: formatDateTime()
    };
  }));
}

export function addComment(stories, id, text) {
  const existing = findStory(stories, id);

  if (!existing) {
    return null;
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    throw validationError("Comment text is required.");
  }

  const nextCommentId = Math.max(0, ...existing.comments.map((comment) => comment.id)) + 1;
  const now = formatDateTime();
  const comment = {
    id: nextCommentId,
    text: text.trim(),
    createdAt: now
  };

  return {
    ...existing,
    comments: [...existing.comments, comment],
    updatedAt: now
  };
}

export function replaceStory(stories, updatedStory) {
  return normalizeTodoPriorities(
    stories.map((story) => (story.id === updatedStory.id ? updatedStory : story))
  );
}

export function sortStories(stories) {
  return [...stories].sort((a, b) => {
    if (a.status === "todo" && b.status === "todo") {
      return a.priority - b.priority;
    }

    return a.id - b.id;
  });
}

export function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateStoryPayload(payload) {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const status = payload.status || "todo";
  const points = Number(payload.points);
  const acceptanceCriteria = Array.isArray(payload.acceptanceCriteria)
    ? payload.acceptanceCriteria.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!title) {
    throw validationError("Title is required.");
  }

  if (!STATUSES.includes(status)) {
    throw validationError("Status must be one of: todo, doing, done.");
  }

  if (payload.points === "" || payload.points === null || payload.points === undefined) {
    throw validationError("Points are required.");
  }

  if (!Number.isInteger(points) || points < 0) {
    throw validationError("Points must be a non-negative integer.");
  }

  if (acceptanceCriteria.length === 0) {
    throw validationError("At least one acceptance criterion is required.");
  }

  return {
    title,
    description,
    status,
    points,
    acceptanceCriteria
  };
}

function nextTodoPriority(stories) {
  const priorities = stories
    .filter((story) => story.status === "todo")
    .map((story) => story.priority || 0);

  return Math.max(0, ...priorities) + 1;
}

function getNextPriority(stories, existing, status, wasTodo) {
  if (status !== "todo") {
    return null;
  }

  return wasTodo ? existing.priority : nextTodoPriority(stories);
}

function normalizeTodoPriorities(stories) {
  let priority = 1;

  return sortStories(stories).map((story) => {
    if (story.status !== "todo") {
      return story;
    }

    return {
      ...story,
      priority: priority++
    };
  });
}

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
