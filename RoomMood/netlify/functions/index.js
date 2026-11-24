const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { firstReminder, randomReminderForDay } = require("./reminder-schedule");

admin.initializeApp();

const db = admin.firestore();
const devices = db.collection("dailyReminderDevices");

exports.manageDailyReminder = onCall({ region: "us-central1", enforceAppCheck: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in is required to manage reminders.");
    }
    const { action } = request.data || {};
    const device = devices.doc(request.auth.uid);

    if (action === "disable") {
        await device.delete();
        return { enabled: false };
    }
    if (action !== "enable") {
        throw new HttpsError("invalid-argument", "Unknown reminder action.");
    }

    const token = typeof request.data.token === "string" ? request.data.token.trim() : "";
    const timeZone = typeof request.data.timeZone === "string" ? request.data.timeZone : "";
    if (!token || token.length > 4096 || !timeZone || !DateTime.now().setZone(timeZone).isValid) {
        throw new HttpsError("invalid-argument", "A valid push token and time zone are required.");
    }

    let nextReminderAt;
    await db.runTransaction(async (transaction) => {
        const current = await transaction.get(device);
        const saved = current.exists ? current.data() : null;
        const sameSchedule = saved && saved.token === token && saved.timeZone === timeZone &&
            saved.nextReminderAt && saved.nextReminderAt.toMillis() > Date.now();
        nextReminderAt = sameSchedule
            ? DateTime.fromMillis(saved.nextReminderAt.toMillis(), { zone: timeZone })
            : firstReminder(timeZone, DateTime.now());
        transaction.set(device, {
            token,
            timeZone,
            nextReminderAt: admin.firestore.Timestamp.fromDate(nextReminderAt.toJSDate()),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    return { enabled: true, nextReminderAt: nextReminderAt.toISO() };
});

exports.sendDailyReminders = onSchedule({
    schedule: "* * * * *",
    timeZone: "UTC",
    region: "us-central1",
    maxInstances: 1
}, async () => {
    const now = admin.firestore.Timestamp.now();
    const dueDevices = await devices.where("nextReminderAt", "<=", now).limit(500).get();
    await Promise.all(dueDevices.docs.map(async (snapshot) => {
        try {
            const claimed = await db.runTransaction(async (transaction) => {
                const current = await transaction.get(snapshot.ref);
                if (!current.exists || current.get("nextReminderAt").toMillis() > now.toMillis()) return null;
                const data = current.data();
                const localNow = DateTime.now().setZone(data.timeZone);
                if (!localNow.isValid || !data.token) {
                    transaction.delete(snapshot.ref);
                    return null;
                }
                const nextDay = localNow.plus({ days: 1 });
                const nextReminderAt = randomReminderForDay(data.timeZone, nextDay);
                transaction.update(snapshot.ref, {
                    nextReminderAt: admin.firestore.Timestamp.fromDate(nextReminderAt.toJSDate()),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return data;
            });
            if (!claimed) return;

            await admin.messaging().send({
                token: claimed.token,
                data: {
                    title: "RoomMood",
                    body: "Wo bist du gerade und was machst du?"
                },
                webpush: { headers: { TTL: "86400" } }
            });
        } catch (error) {
            if (error.code === "messaging/registration-token-not-registered" ||
                error.code === "messaging/invalid-registration-token") {
                await snapshot.ref.delete();
                return;
            }
            logger.error("Daily reminder delivery failed", { deviceId: snapshot.id, error });
            const timeZone = snapshot.get("timeZone");
            const retryFrom = DateTime.now().setZone(timeZone).plus({ minutes: 15 });
            if (!retryFrom.isValid) {
                await snapshot.ref.delete();
                return;
            }
            await snapshot.ref.update({
                nextReminderAt: admin.firestore.Timestamp.fromDate(
                    firstReminder(timeZone, retryFrom).toJSDate()
                ),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }));
});
