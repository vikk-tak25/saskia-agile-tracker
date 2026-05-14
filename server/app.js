import express from "express";
import cors from "cors";
import {
  addComment,
  createStory,
  deleteComment,
  findStory,
  readStories,
  reorderStoriesByStatus,
  replaceStory,
  saveStories,
  updateStory,
  updateStoryStatus
} from "./storyStore.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/stories", async (req, res, next) => {
  try {
    const stories = await readStories();
    res.json(stories);
  } catch (error) {
    next(error);
  }
});

app.get("/api/stories/:id", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = findStory(stories, req.params.id);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    res.json(story);
  } catch (error) {
    next(error);
  }
});

app.post("/api/stories", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = createStory(stories, req.body);
    const updatedStories = [...stories, story];
    await saveStories(updatedStories);
    res.status(201).json(story);
  } catch (error) {
    next(error);
  }
});

app.put("/api/stories/:id", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = updateStory(stories, req.params.id, req.body);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    const updatedStories = replaceStory(stories, story);
    await saveStories(updatedStories);
    res.json(findStory(updatedStories, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/stories/:id", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = findStory(stories, req.params.id);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    const updatedStories = replaceStory(
      stories.filter((item) => item.id !== story.id),
      story
    ).filter((item) => item.id !== story.id);

    await saveStories(updatedStories);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.patch("/api/stories/:id/status", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = updateStoryStatus(stories, req.params.id, req.body.status);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    const updatedStories = replaceStory(stories, story);
    await saveStories(updatedStories);
    res.json(findStory(updatedStories, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/stories/reorder", async (req, res, next) => {
  try {
    const stories = await readStories();
    const storyIds = req.body.storyIds || req.body.orderedIds;
    const status = req.body.status || "todo";
    const updatedStories = reorderStoriesByStatus(stories, storyIds, status);
    await saveStories(updatedStories);
    res.json(updatedStories.filter((story) => story.status === status));
  } catch (error) {
    next(error);
  }
});

app.post("/api/stories/:id/comments", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = addComment(stories, req.params.id, req.body.text);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    const updatedStories = replaceStory(stories, story);
    await saveStories(updatedStories);
    res.status(201).json(findStory(updatedStories, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/stories/:id/comments/:commentId", async (req, res, next) => {
  try {
    const stories = await readStories();
    const story = deleteComment(stories, req.params.id, req.params.commentId);

    if (!story) {
      return res.status(404).json({ error: "Story not found." });
    }

    const updatedStories = replaceStory(stories, story);
    await saveStories(updatedStories);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = status === 500 ? "Server error." : error.message;

  res.status(status).json({ error: message });
});

export default app;
