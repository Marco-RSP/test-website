const test = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { firstReminder, randomReminderForDay } = require("./reminder-schedule");

function assertWithinLocalHours(reminder, timeZone, expectedDay) {
    const local = reminder.setZone(timeZone);
    assert.equal(local.toISODate(), expectedDay);
    assert.ok(local.hour >= 8 && (local.hour < 22 || (local.hour === 22 && local.minute === 0 && local.second === 0)));
}

test("first reminder is today and no earlier than the current time", () => {
    const now = DateTime.fromISO("2026-01-15T10:30:00", { zone: "Europe/Berlin" });
    const reminder = firstReminder("Europe/Berlin", now);
    assertWithinLocalHours(reminder, "Europe/Berlin", "2026-01-15");
    assert.ok(reminder.toMillis() >= now.toMillis());
});

test("first reminder before the window is scheduled between 08:00 and 22:00", () => {
    const now = DateTime.fromISO("2026-01-15T06:00:00", { zone: "Europe/Berlin" });
    const reminder = firstReminder("Europe/Berlin", now);
    assertWithinLocalHours(reminder, "Europe/Berlin", "2026-01-15");
});

test("first reminder after the window is scheduled the next day", () => {
    const now = DateTime.fromISO("2026-01-15T22:00:00", { zone: "Europe/Berlin" });
    const reminder = firstReminder("Europe/Berlin", now);
    assertWithinLocalHours(reminder, "Europe/Berlin", "2026-01-16");
});

test("recurring reminder is scheduled for the next local day", () => {
    const now = DateTime.fromISO("2026-03-28T21:59:00", { zone: "Europe/Berlin" });
    const reminder = randomReminderForDay("Europe/Berlin", now.plus({ days: 1 }));
    assertWithinLocalHours(reminder, "Europe/Berlin", "2026-03-29");
});
