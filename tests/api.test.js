import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/stories.json");

let originalData;
let createdId;

before(async () => {
  originalData = await readFile(DATA_FILE, "utf8");
});

after(async () => {
  await writeFile(DATA_FILE, originalData);
});

describe("REST API", { concurrency: false }, () => {
  it("GET /api/stories returns 200 and an array", async () => {
    const res = await request(app).get("/api/stories");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it("POST /api/stories creates a story and returns 201", async () => {
    const res = await request(app)
      .post("/api/stories")
      .send({
        title: "Test story",
        description: "Created by automated test",
        status: "todo",
        points: 3,
        acceptanceCriteria: ["At least one criterion"]
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, "Test story");
    assert.ok(typeof res.body.id === "number");
    createdId = res.body.id;
  });

  it("POST /api/stories returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/stories")
      .send({ points: 3, acceptanceCriteria: ["One"] });
    assert.equal(res.status, 400);
  });

  it("POST /api/stories returns 400 when acceptance criteria is empty", async () => {
    const res = await request(app)
      .post("/api/stories")
      .send({ title: "No AC", points: 3, acceptanceCriteria: [] });
    assert.equal(res.status, 400);
  });

  it("GET /api/stories/:id returns the created story", async () => {
    const res = await request(app).get(`/api/stories/${createdId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, createdId);
    assert.equal(res.body.title, "Test story");
  });

  it("GET /api/stories/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/api/stories/99999");
    assert.equal(res.status, 404);
  });

  it("PATCH /api/stories/:id/status changes status", async () => {
    const res = await request(app)
      .patch(`/api/stories/${createdId}/status`)
      .send({ status: "doing" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "doing");
  });

  it("PATCH /api/stories/:id/status returns 400 for invalid status", async () => {
    const res = await request(app)
      .patch(`/api/stories/${createdId}/status`)
      .send({ status: "invalid" });
    assert.equal(res.status, 400);
  });

  it("POST /api/stories/:id/comments adds a comment", async () => {
    const res = await request(app)
      .post(`/api/stories/${createdId}/comments`)
      .send({ text: "Test comment" });
    assert.equal(res.status, 201);
    assert.ok(res.body.comments.some((c) => c.text === "Test comment"));
  });

  it("DELETE /api/stories/:id deletes the story and returns 204", async () => {
    const res = await request(app).delete(`/api/stories/${createdId}`);
    assert.equal(res.status, 204);
  });

  it("GET /api/stories/:id returns 404 after deletion", async () => {
    const res = await request(app).get(`/api/stories/${createdId}`);
    assert.equal(res.status, 404);
  });
});
