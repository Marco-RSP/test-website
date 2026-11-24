const { DateTime } = require("luxon");

function randomReminderForDay(timeZone, day) {
    const localDay = day.setZone(timeZone).startOf("day");
    const start = localDay.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    const end = localDay.set({ hour: 22, minute: 0, second: 0, millisecond: 0 });
    return DateTime.fromMillis(
        start.toMillis() + Math.random() * (end.toMillis() - start.toMillis()),
        { zone: timeZone }
    );
}

function firstReminder(timeZone, now) {
    const localNow = now.setZone(timeZone);
    const todayStart = localNow.startOf("day").set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    const todayEnd = localNow.startOf("day").set({ hour: 22, minute: 0, second: 0, millisecond: 0 });
    if (localNow.toMillis() >= todayEnd.toMillis()) {
        return randomReminderForDay(timeZone, localNow.plus({ days: 1 }));
    }
    const earliest = Math.max(localNow.toMillis(), todayStart.toMillis());
    return DateTime.fromMillis(
        earliest + Math.random() * (todayEnd.toMillis() - earliest),
        { zone: timeZone }
    );
}

module.exports = { firstReminder, randomReminderForDay };
