import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import app from "../api/index.js";

describe("Vercel entrypoint", () => {
  it("exports an Express app that serves API health", async () => {
    const response = await request(app).get("/api/health").expect(200);

    assert.equal(response.body.status, "ok");
  });
});
