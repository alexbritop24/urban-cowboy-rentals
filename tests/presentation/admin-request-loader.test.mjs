import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRequestLoader } from "../../src/services/adminRequestLoader.ts";

const createHarness = (reads) => {
  const events = [];
  let readIndex = 0;
  const loader = createAdminRequestLoader(
    async () => {
      const next = reads[readIndex++];
      if (next instanceof Error) throw next;
      return next;
    },
    {
      onInitialLoading: () => events.push({ type: "loading" }),
      onRefreshing: () => events.push({ type: "refreshing" }),
      onSuccess: (data) => events.push({ type: "success", data }),
      onFailure: (error, isInitialLoad) =>
        events.push({ type: "failure", error, isInitialLoad }),
    }
  );
  return { events, loader };
};

test("initial load failure is distinct and retry can succeed", async () => {
  const { events, loader } = createHarness([
    new Error("RLS failure"),
    [{ id: "request-1" }],
  ]);

  await loader.load();
  assert.deepEqual(events, [
    { type: "loading" },
    { type: "failure", error: new Error("RLS failure"), isInitialLoad: true },
  ]);

  await loader.load();
  assert.equal(events[2].type, "loading");
  assert.deepEqual(events[3], {
    type: "success",
    data: [{ id: "request-1" }],
  });
});

test("successful empty result remains a successful empty state", async () => {
  const { events, loader } = createHarness([[]]);

  await loader.load();

  assert.deepEqual(events, [
    { type: "loading" },
    { type: "success", data: [] },
  ]);
});

test("refresh failure is classified separately and does not replace stale data", async () => {
  const { events, loader } = createHarness([
    [{ id: "request-1" }],
    new Error("network failure"),
  ]);

  await loader.load();
  await loader.load();

  assert.deepEqual(events, [
    { type: "loading" },
    { type: "success", data: [{ id: "request-1" }] },
    { type: "refreshing" },
    {
      type: "failure",
      error: new Error("network failure"),
      isInitialLoad: false,
    },
  ]);
});

test("overlapping loads share one read and one result", async () => {
  let resolveRead;
  let readCount = 0;
  const events = [];
  const loader = createAdminRequestLoader(
    () => {
      readCount += 1;
      return new Promise((resolve) => {
        resolveRead = resolve;
      });
    },
    {
      onInitialLoading: () => events.push("loading"),
      onRefreshing: () => events.push("refreshing"),
      onSuccess: (data) => events.push(["success", data]),
      onFailure: () => events.push("failure"),
    }
  );

  const first = loader.load();
  const second = loader.load();
  assert.strictEqual(first, second);
  assert.equal(readCount, 1);

  resolveRead([{ id: "request-1" }]);
  await first;
  assert.deepEqual(events, ["loading", ["success", [{ id: "request-1" }]]]);
});
