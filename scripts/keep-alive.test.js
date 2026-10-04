"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildLockFilter,
  shouldSendKeepAlive,
} = require("./keep-alive.js");

const MINUTE = 60_000;

test("active users do not trigger a keep-alive", () => {
  const now = Date.UTC(2026, 9, 4, 14, 0, 0);
  const state = {
    lastRealUserActivity: new Date(now - 2 * MINUTE),
    lastKeepAliveAt: new Date(now - 20 * MINUTE),
  };
  assert.equal(shouldSendKeepAlive(state, now, 8 * MINUTE), false);
});

test("inactive users trigger only after both thresholds have elapsed", () => {
  const now = Date.UTC(2026, 9, 4, 14, 0, 0);
  const state = {
    lastRealUserActivity: new Date(now - 9 * MINUTE),
    lastKeepAliveAt: new Date(now - 9 * MINUTE),
  };
  assert.equal(shouldSendKeepAlive(state, now, 8 * MINUTE), true);
});

test("recent keep-alive suppresses another ping", () => {
  const now = Date.UTC(2026, 9, 4, 14, 0, 0);
  const state = {
    lastRealUserActivity: new Date(now - 20 * MINUTE),
    lastKeepAliveAt: new Date(now - 3 * MINUTE),
  };
  assert.equal(shouldSendKeepAlive(state, now, 8 * MINUTE), false);
});

test("missing initial timestamps fail safe and do not ping", () => {
  const now = Date.UTC(2026, 9, 4, 14, 0, 0);
  assert.equal(shouldSendKeepAlive({}, now, 8 * MINUTE), false);
});

test("atomic lock filter compares Mongo Date values, not numeric milliseconds", () => {
  const now = new Date("2026-10-04T14:00:00.000Z");
  const filter = buildLockFilter(now, 8 * MINUTE);
  assert.ok(filter.lastRealUserActivity.$lte instanceof Date);
  assert.ok(filter.lastKeepAliveAt.$lte instanceof Date);
  assert.ok(filter.$or[2].keepAliveLockUntil.$lte instanceof Date);
  assert.equal(
    filter.lastRealUserActivity.$lte.toISOString(),
    "2026-10-04T13:52:00.000Z",
  );
});
