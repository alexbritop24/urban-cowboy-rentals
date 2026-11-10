import assert from "node:assert/strict";
import test from "node:test";

import { mountainBookingDateTimeToIso } from "../../src/utils/bookingDateTime.ts";

test("booking times use Utah's winter and summer offsets", () => {
  assert.equal(mountainBookingDateTimeToIso("2027-01-25T09:15"), "2027-01-25T16:15:00.000Z");
  assert.equal(mountainBookingDateTimeToIso("2027-07-25T09:15"), "2027-07-25T15:15:00.000Z");
});

test("booking times reject the spring gap and use the first occurrence in fall", () => {
  assert.equal(mountainBookingDateTimeToIso("2027-03-14T02:15"), null);
  assert.equal(mountainBookingDateTimeToIso("2027-11-07T01:15"), "2027-11-07T07:15:00.000Z");
});
