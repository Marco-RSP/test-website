// --- 1. FIREBASE INITIALISIERUNG ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { getMessaging, getToken, deleteToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";

// ⚠️ DEINE ECHTEN ZUGANGSDATEN AUS DER FIREBASE CONSOLE EINFÜGEN ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyDVBS96MAnAGuyWwqMb2WTbZAsh5b22mRM",
    authDomain: "roommood-c198a.firebaseapp.com",
    projectId: "roommood-c198a",
    storageBucket: "roommood-c198a.firebasestorage.app",
    messagingSenderId: "850202778777",
    appId: "1:850202778777:web:5f62811546b49f44766c08"
};

// Save edited calendar event from modal
window.saveEditEvent = function () {
    if (!editingEventId) return;
    const ev = (appData.events || []).find(e => e.id === editingEventId);
    if (!ev) return;
    ev.title = document.getElementById('edit-event-title').value.trim() || ev.title;
    ev.start = document.getElementById('edit-event-start').value || ev.start;
    ev.end = document.getElementById('edit-event-end').value || ev.end;
    const sel = document.getElementById('edit-event-person');
    if (sel) ev.persons = Array.from(sel.selectedOptions).map(o => o.value).filter(v => v);
    saveToFirebase();
    closeModal('edit-event-modal');
    editingEventId = null;
    renderCalendar();
};

// Show circular preview when editing member image
window.handleEditMemberImageChange = async function (event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
        const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(null); fr.readAsDataURL(file);
    });
    if (!dataUrl) return;
    const preview = document.getElementById('edit-member-preview');
    if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="preview">`;
    // also set the file input value to be read by saveEditMember when saving
    const fileInput = document.getElementById('edit-member-image');
    if (fileInput) {
        try { /* nothing to do, file already set */ } catch (e) { }
    }

    // --- EINKAUFSLISTE: Render, Add, Toggle, Delete, Drag&Drop Reorder ---
    function renderShopping() {
        const list = document.getElementById('shopping-list');
        if (!list) return;
        if (!appData.shopping || appData.shopping.length === 0) {
            list.innerHTML = '<p style="color:gray; font-size:0.85rem;">Keine Einträge.</p>';
            return;
        }

        list.innerHTML = appData.shopping.map(item => `
    <li class="shopping-item" draggable="true" data-id="${item.id}" style="display:flex; align-items:center; justify-content:space-between; padding:8px; border-radius:6px; background:rgba(0,0,0,0.02); margin-bottom:6px;">
      <div style="display:flex; gap:10px; align-items:center; flex:1;">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleShoppingDone(${item.id})">
        <div style="flex:1;">${escapeHtml(item.title)}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-left:8px;">
        <button class="btn-link" onclick="deleteShoppingItem(${item.id})" style="color:#e74c3c;">Löschen</button>
        <span class="drag-handle" style="cursor:grab;">☰</span>
      </div>
    </li>
  `).join('');

        // Attach drag handlers
        try {
            const items = Array.from(list.querySelectorAll('.shopping-item'));
            items.forEach(li => {
                li.addEventListener('dragstart', (e) => {
                    try {
                        e.dataTransfer.setData('text/plain', li.getAttribute('data-id'));
                        e.dataTransfer.effectAllowed = 'move';
                        li.classList.add('dragging');
                    } catch (err) { }
                });
                li.addEventListener('dragend', () => { li.classList.remove('dragging'); });
                li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
                li.addEventListener('dragleave', () => { li.classList.remove('drag-over'); });
                li.addEventListener('drop', (e) => {
                    e.preventDefault();
                    li.classList.remove('drag-over');
                    try {
                        const srcId = e.dataTransfer.getData('text/plain');
                        const targetId = li.getAttribute('data-id');
                        if (srcId && targetId && srcId !== targetId) reorderShopping(Number(srcId), Number(targetId));
                    } catch (err) { }
                });
            });

            // ensure list allows drops (for gaps)
            list.addEventListener('dragover', (e) => { e.preventDefault(); }, { passive: false });
        } catch (e) { console.warn('attach shopping drag handlers failed', e); }
    }

    function addShoppingItem() {
        const input = document.getElementById('shopping-input');
        if (!input) return;
        const title = (input.value || '').trim();
        if (!title) return;
        if (!appData.shopping) appData.shopping = [];
        const item = { id: Date.now(), title: title, done: false };
        appData.shopping.push(item);
        input.value = '';
        saveToFirebase();
        renderShopping();
    }
    window.addShoppingItem = addShoppingItem;

    function toggleShoppingDone(id) {
        if (!appData.shopping) return;
        const it = appData.shopping.find(s => s.id === id);
        if (it) { it.done = !it.done; saveToFirebase(); renderShopping(); }
    }
    window.toggleShoppingDone = toggleShoppingDone;

    function deleteShoppingItem(id) {
        appData.shopping = (appData.shopping || []).filter(s => s.id !== id);
        saveToFirebase();
        renderShopping();
    }
    window.deleteShoppingItem = deleteShoppingItem;

    function reorderShopping(srcId, targetId) {
        if (!appData.shopping) return;
        const arr = appData.shopping;
        const srcIndex = arr.findIndex(i => i.id === srcId);
        const targetIndex = arr.findIndex(i => i.id === targetId);
        if (srcIndex === -1 || targetIndex === -1) return;
        const [item] = arr.splice(srcIndex, 1);
        // if moving downwards, insert after target's new index
        const insertIndex = srcIndex < targetIndex ? targetIndex : targetIndex;
        arr.splice(insertIndex, 0, item);
        appData.shopping = arr;
        saveToFirebase();
        renderShopping();
    }
    window.reorderShopping = reorderShopping;
};

// Save member edits from modal
window.saveEditMember = async function () {
    if (editingMemberIndex === null || editingMemberIndex === undefined) return;
    const idx = editingMemberIndex;
    const member = appData.members[idx];
    if (!member) return;
    // read color, status, emoji, loc
    const color = document.getElementById('edit-member-color').value;
    const emoji = document.getElementById('edit-member-emoji').value;
    const status = document.getElementById('edit-member-status').value.trim();
    const locEmoji = document.getElementById('edit-member-locemoji').value;
    const locText = document.getElementById('edit-member-loctext').value.trim();

    member.color = color || member.color;
    member.emoji = emoji || member.emoji;
    member.status = status;
    member.locEmoji = locEmoji || member.locEmoji;
    member.locText = locText;

    // if file chosen in modal, read it
    const fileInput = document.getElementById('edit-member-image');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const dataUrl = await new Promise((resolve) => {
            const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(null); fr.readAsDataURL(fileInput.files[0]);
        });
        if (dataUrl) member.image = dataUrl;
    }

    // Registrierung / Anmeldung absenden
    window.submitRegistration = async function () {
        const name = (document.getElementById('reg-username') && document.getElementById('reg-username').value) ? document.getElementById('reg-username').value.trim() : '';
        if (!name) { alert('Bitte Namen eingeben.'); return; }
        appData.user.name = name;

        if (activeRegistrationMode === 0) {
            // Create new WG
            const homeName = (document.getElementById('reg-homename') && document.getElementById('reg-homename').value) ? document.getElementById('reg-homename').value.trim() : 'Meine WG';
            appData.user.homeName = homeName;
            const code = 'RM-' + Math.floor(1000 + Math.random() * 9000);
            appData.user.homeCode = code;

            // Initialize home document in Firestore
            try {
                const homeRef = doc(db, 'homes', code);
                await setDoc(homeRef, {
                    homeName: homeName,
                    members: [{ name: name, emoji: appData.user.emoji || '😎', color: '#364940' }],
                    rooms: [],
                    moodRooms: [],
                    chores: [],
                    tasks: [],
                    shopping: [],
                    events: []
                });
            } catch (e) {
                console.error('create home error', e);
                alert('Fehler beim Erstellen der WG.');
                return;
            }
        } else {
            // Join existing WG
            const code = (document.getElementById('reg-homecode') && document.getElementById('reg-homecode').value) ? document.getElementById('reg-homecode').value.trim().toUpperCase() : '';
            if (!code) { alert('Bitte WG-Code eingeben.'); return; }
            try {
                const homeRef = doc(db, 'homes', code);
                const snap = await getDoc(homeRef);
                if (!snap.exists()) { alert('WG nicht gefunden.'); return; }
                const data = snap.data() || {};
                appData.user.homeName = data.homeName || '';
                appData.user.homeCode = code;
                // add member if not exists
                const members = data.members || [];
                if (!members.find(m => m.name === name)) {
                    members.push({ name: name, emoji: appData.user.emoji || '😎', color: '#364940' });
                    await setDoc(homeRef, { members }, { merge: true });
                }
            } catch (e) {
                console.error('join home error', e);
                alert('Fehler beim Beitreten der WG.');
                return;
            }
        }

        // persist locally so refresh keeps the user logged in
        try { localStorage.setItem('roommood_user', JSON.stringify(appData.user)); } catch (e) { console.warn('localStorage error', e); }

        // show main app and start sync
        document.getElementById('registration-page').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        syncWithFirebase();
    };

    await saveToFirebase();
    closeModal('edit-member-modal');
    renderDashboard();
    populateMemberSelects();
    editingMemberIndex = null;
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const appCheckSiteKey = document.querySelector('meta[name="firebase-app-check-site-key"]')?.content.trim();
if (appCheckSiteKey) {
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
    });
}
let messagingInstance = null;
let foregroundMessagesListening = false;

async function getRoomMoodMessaging() {
    if (!("serviceWorker" in navigator) || !(await isSupported())) {
        throw new Error("Dieser Browser unterstützt keine Push-Benachrichtigungen.");
    }
    if (!messagingInstance) {
        messagingInstance = getMessaging(app);
        if (!foregroundMessagesListening) {
            onMessage(messagingInstance, (payload) => {
                if (Notification.permission !== "granted") return;
                const data = payload.data || {};
                new Notification(data.title || "RoomMood", {
                    body: data.body || "Wo bist du gerade und was machst du?",
                    icon: "roommood_logo-192.png",
                    tag: "roommood-daily-checkin"
                });
            });
            foregroundMessagesListening = true;
        }
    }
    return messagingInstance;
}

async function saveDailyReminderSubscription() {
    const vapidKey = document.querySelector('meta[name="firebase-vapid-key"]')?.content.trim();
    if (!vapidKey || !appCheckSiteKey) {
        throw new Error("Push ist noch nicht konfiguriert. Bitte Firebase-Schlüssel gemäß PUSH_NOTIFICATIONS.md eintragen.");
    }
    if (!auth.currentUser) await signInAnonymously(auth);
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const messaging = await getRoomMoodMessaging();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error("Der Browser konnte kein Push-Abonnement erstellen.");
    const manageReminder = httpsCallable(functions, "manageDailyReminder");
    return manageReminder({
        action: "enable",
        token,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
}

function renderDailyReminderStatus(message) {
    const status = document.getElementById("daily-reminder-status");
    const enableButton = document.getElementById("enable-daily-reminder");
    const disableButton = document.getElementById("disable-daily-reminder");
    if (!status || !enableButton || !disableButton) return;
    const enabled = localStorage.getItem("roommood_daily_reminder_enabled") === "true";
    const permissionGranted = "Notification" in window && Notification.permission === "granted";
    status.textContent = message || (enabled
        ? permissionGranted
            ? "Erinnerung aktiv – du erhältst täglich eine Benachrichtigung."
            : "Erinnerung gespeichert, aber Browser-Benachrichtigungen sind derzeit nicht erlaubt."
        : "Erinnerung deaktiviert.");
    enableButton.classList.toggle("hidden", enabled && permissionGranted);
    disableButton.classList.toggle("hidden", !enabled);
}

window.enableDailyReminder = async function () {
    const status = document.getElementById("daily-reminder-status");
    const enableButton = document.getElementById("enable-daily-reminder");
    if (!status || !enableButton) return;
    enableButton.disabled = true;
    status.textContent = "Benachrichtigung wird eingerichtet …";
    try {
        if (!window.isSecureContext || !("Notification" in window)) {
            throw new Error("Benachrichtigungen benötigen einen unterstützten Browser und eine sichere Verbindung (HTTPS).");
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error(permission === "denied"
                ? "Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen."
                : "Bitte erlaube Benachrichtigungen, um die Erinnerung zu aktivieren.");
        }

        await saveDailyReminderSubscription();
        localStorage.setItem("roommood_daily_reminder_enabled", "true");
        renderDailyReminderStatus("Erinnerung aktiv – du erhältst täglich eine Benachrichtigung.");
    } catch (error) {
        console.error("Daily reminder setup failed", error);
        status.textContent = error.message || "Die Erinnerung konnte nicht eingerichtet werden.";
    } finally {
        enableButton.disabled = false;
    }
};

window.disableDailyReminder = async function () {
    const status = document.getElementById("daily-reminder-status");
    const disableButton = document.getElementById("disable-daily-reminder");
    if (!status || !disableButton) return;
    disableButton.disabled = true;
    status.textContent = "Erinnerung wird deaktiviert …";
    try {
        if (!auth.currentUser) await signInAnonymously(auth);
        const manageReminder = httpsCallable(functions, "manageDailyReminder");
        await manageReminder({ action: "disable" });
        localStorage.removeItem("roommood_daily_reminder_enabled");
        let tokenCleanupFailed = false;
        if (messagingInstance) {
            try {
                await deleteToken(messagingInstance);
            } catch (error) {
                console.error("Daily reminder token cleanup failed", error);
                tokenCleanupFailed = true;
            }
        }
        renderDailyReminderStatus(tokenCleanupFailed
            ? "Erinnerung deaktiviert; das lokale Browser-Abonnement konnte nicht entfernt werden."
            : "Erinnerung deaktiviert.");
    } catch (error) {
        console.error("Daily reminder disable failed", error);
        status.textContent = error.message || "Die Erinnerung konnte nicht deaktiviert werden.";
    } finally {
        disableButton.disabled = false;
    }
};

// --- DATEN-STATE (OHNE DUMMY-PLATZHALTER) ---
const emojis = ["😎", "😊", "😴", "☕️", "🥳", "😭", "😤", "🍕", "✨", "🧹", "🧼", "🚨", "🤓", "🤩", "🤠", "🫶", "💤", "😇", "😅", "🙃", "🤪", "😴"];
const locEmojis = ["🏠", "🏢", "🎓", "🏋️‍♂️", "🛌", "🚂", "🍻", "📍", "🐴"];

let appData = {
    user: { name: "", homeName: "", homeCode: "", emoji: "😎", status: "Entspannt", locEmoji: "🏠", locText: "Zuhause" },
    members: [],
    rooms: [],
    moodRooms: [],
    chores: [],
    tasks: [],
    shopping: [],
    events: []
};

let activeRegistrationMode = 0;
let currentCalDate = new Date();
let selectedCalDate = new Date();
let targetMoodRoomId = null;
let editingRoomId = null;
let editingMoodRoomId = null;
let editingEventId = null;
let editingMemberIndex = null;
// flag to ensure swipe listeners attached only once
let calendarSwipeInitialized = false;
let editingChoreId = null;

// --- ECHTZEIT-SYNCHRONISATION MIT FIREBASE ---
function syncWithFirebase() {
    if (!appData.user.homeCode) return;

    const homeRef = doc(db, "homes", appData.user.homeCode);

    onSnapshot(homeRef, (docSnap) => {
        if (docSnap.exists()) {
            const remoteData = docSnap.data();
            appData.user.homeName = remoteData.homeName || appData.user.homeName;
            appData.members = remoteData.members || [];
            // preserve local user's vibe/status/location if already set locally
            try {
                const me = (appData.members || []).find(m => m.name === (appData.user && appData.user.name));
                if (me) {
                    // Only copy fields into appData.user if they are not already set locally
                    if (!appData.user.emoji && me.emoji) appData.user.emoji = me.emoji;
                    if (!appData.user.status && me.status) appData.user.status = me.status;
                    if (!appData.user.locEmoji && me.locEmoji) appData.user.locEmoji = me.locEmoji;
                    if (!appData.user.locText && me.locText) appData.user.locText = me.locText;
                    if (!appData.user.color && me.color) appData.user.color = me.color;
                }
            } catch (e) { }
            appData.rooms = remoteData.rooms || [];
            appData.moodRooms = remoteData.moodRooms || [];
            appData.chores = remoteData.chores || [];
            appData.tasks = remoteData.tasks || [];
            appData.shopping = remoteData.shopping || [];
            appData.events = remoteData.events || [];

            renderAllViews();
        }

        // --- ROOM / MOODROOM EDIT / DELETE ---
        window.openEditRoom = function (id) {
            editingRoomId = id;
            const room = appData.rooms.find(r => r.id === id);
            if (!room) return;
            document.getElementById('edit-room-name').value = room.name || '';
            document.getElementById('edit-room-cleanliness').value = room.cleanliness || '';
            document.getElementById('edit-room-comment').value = room.comment || '';
            openModal('edit-room-modal');
        };

        window.saveEditRoom = function () {
            if (!editingRoomId) return;
            const room = appData.rooms.find(r => r.id === editingRoomId);
            if (!room) return;
            room.name = document.getElementById('edit-room-name').value.trim() || room.name;
            room.cleanliness = document.getElementById('edit-room-cleanliness').value || room.cleanliness;
            room.comment = document.getElementById('edit-room-comment').value || room.comment;
            saveToFirebase();
            closeModal('edit-room-modal');
            renderDashboard();
        };

        window.deleteRoom = function (id) {
            if (!confirm('Raum wirklich löschen?')) return;
            appData.rooms = appData.rooms.filter(r => r.id !== id);
            saveToFirebase();
            renderDashboard();
        };

        window.openEditMoodRoom = function (id) {
            editingMoodRoomId = id;
            const mr = appData.moodRooms.find(m => m.id === id);
            if (!mr) return;
            document.getElementById('edit-moodroom-name').value = mr.name || '';
            document.getElementById('edit-moodroom-note').value = mr.note || '';
            openModal('edit-moodroom-modal');
        };

        window.saveEditMoodRoom = function () {
            if (!editingMoodRoomId) return;
            const mr = appData.moodRooms.find(m => m.id === editingMoodRoomId);
            if (!mr) return;
            mr.name = document.getElementById('edit-moodroom-name').value.trim() || mr.name;
            mr.note = document.getElementById('edit-moodroom-note').value || mr.note;
            saveToFirebase();
            closeModal('edit-moodroom-modal');
            renderDashboard();
        };

        window.deleteMoodRoom = function (id) {
            if (!confirm('Vibe-Raum wirklich löschen?')) return;
            appData.moodRooms = appData.moodRooms.filter(m => m.id !== id);
            saveToFirebase();
            renderDashboard();
        };

        // Öffnet den file picker für ein bestimmtes Mitglied
        window.openMemberImagePicker = function (index) {
            const inp = document.getElementById(`member-image-${index}`);
            if (inp) inp.click();
        };

        // Öffnet einen einfachen Edit-Dialog für Mitglied: Farbe wählen + optional Bild hochladen
        window.openEditMember = async function (index) {
            // open the full modal for editing member (only allow editing own profile)
            if (!appData.members || !appData.members[index]) return;
            const member = appData.members[index];
            // only allow editing if this is the logged-in user
            if (member.name !== appData.user.name) {
                alert('Du kannst nur dein eigenes Profil bearbeiten.');
                return;
            }
            editingMemberIndex = index;
            document.getElementById('edit-member-name').value = member.name || '';
            document.getElementById('edit-member-color').value = member.color || '#364940';
            document.getElementById('edit-member-status').value = member.status || '';
            document.getElementById('edit-member-loctext').value = member.locText || '';
            // populate emoji selects
            const emojiSel = document.getElementById('edit-member-emoji');
            const locSel = document.getElementById('edit-member-locemoji');
            if (emojiSel) {
                emojiSel.innerHTML = (emojis.concat(['🐴'])).map(e => `<option value="${e}" ${e === member.emoji ? 'selected' : ''}>${e}</option>`).join('');
            }
            if (locSel) {
                // ensure horse emoji present
                const locs = locEmojis.slice();
                if (!locs.includes('🐴')) locs.push('🐴');
                locSel.innerHTML = locs.map(e => `<option value="${e}" ${e === member.locEmoji ? 'selected' : ''}>${e}</option>`).join('');
            }
            openModal('edit-member-modal');
        };

        // quick palette click handler (delegated)
        document.addEventListener('click', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('palette-btn')) {
                const color = e.target.getAttribute('data-color');
                const inp = document.getElementById('edit-member-color');
                if (inp) inp.value = color;
            }
        });

        // Behandelt das ausgewählte Bild und speichert es als data-URL im Member-Objekt
        window.handleMemberImageChange = async function (event, index) {
            const file = event && event.target && event.target.files && event.target.files[0];
            if (!file) return;
            const dataUrl = await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(file);
            });
            if (!dataUrl) return;
            if (!appData.members || !appData.members[index]) return;
            appData.members[index].image = dataUrl;
            await saveToFirebase();
            renderDashboard();
            populateMemberSelects();
        };
    });
}

async function saveToFirebase() {
    if (!appData.user.homeCode) return;
    const homeRef = doc(db, "homes", appData.user.homeCode);

    await setDoc(homeRef, {
        homeName: appData.user.homeName,
        members: appData.members,
        rooms: appData.rooms,
        moodRooms: appData.moodRooms,
        chores: appData.chores,
        tasks: appData.tasks,
        shopping: appData.shopping,
        events: appData.events
    }, { merge: true });
}

// --- INITIALISIERUNG & SPLASH SCREEN ---
window.addEventListener("DOMContentLoaded", () => {
    populateEmojiDropdowns();
    renderDailyReminderStatus();
    if (localStorage.getItem("roommood_daily_reminder_enabled") === "true" &&
        "Notification" in window && Notification.permission === "granted") {
        saveDailyReminderSubscription().catch((error) => {
            console.error("Daily reminder messaging setup failed", error);
            renderDailyReminderStatus(`Erinnerung aktiv, Synchronisierung fehlgeschlagen: ${error.message}`);
        });
    }

    const savedUser = localStorage.getItem("roommood_user");
    if (savedUser) {
        appData.user = JSON.parse(savedUser);
    }

    // Do not overwrite user's vibe/status from localStorage when syncing initial data
    // Ensure appData.user retains saved emoji/status unless user edits them

    // Splash Screen nach 2.5 Sekunden ausblenden
    setTimeout(() => {
        const splash = document.getElementById("starting-page");
        if (splash) splash.classList.add("fade-out");

        setTimeout(() => {
            if (splash) splash.classList.remove("active");
            // Wenn bereits lokale Profildaten vorhanden sind, automatisch einloggen
            const saved = localStorage.getItem('roommood_user');
            if (saved) {
                try { appData.user = JSON.parse(saved); } catch (e) { }
            }
            if (appData.user && appData.user.homeCode) {
                // show main app and start sync
                document.getElementById('main-app').classList.add('active');
                syncWithFirebase();
            } else {
                // show registration when kein saved user
                document.getElementById("registration-page").classList.add("active");
            }
        }, 600);
    }, 2500);

    document.getElementById("reg-username").addEventListener("input", checkRegButton);
    document.getElementById("reg-homename").addEventListener("input", checkRegButton);
    document.getElementById("reg-create-password").addEventListener("input", checkRegButton);
    const confirmPassEl = document.getElementById("reg-create-password-confirm");
    if (confirmPassEl) confirmPassEl.addEventListener("input", checkRegButton);
    document.getElementById("reg-homecode").addEventListener("input", checkRegButton);
    document.getElementById("reg-join-password").addEventListener("input", checkRegButton);
    // initial scale setup and on resize
    updateAppScale();
    window.addEventListener('resize', updateAppScale);
});

// Skaliert #app-container so, dass das ursprüngliche Seitenverhältnis erhalten bleibt
function updateAppScale() {
    const container = document.getElementById('app-container');
    if (!container) return;
    const baseW = 480;
    const baseH = 900;
    // On narrow viewports (mobile) avoid JS scaling — use responsive CSS instead
    if (window.innerWidth <= 520) {
        container.style.transform = 'none';
        container.style.width = '100%';
        container.style.height = '100%';
        return;
    }
    const scale = Math.min(window.innerWidth / baseW, window.innerHeight / baseH);
    container.style.transform = `scale(${scale})`;
}

// --- REGISTRIERUNG & LOGIN ---
window.setRegMode = function (mode) {
    activeRegistrationMode = mode;
    showError("");
    document.getElementById("btn-mode-0").classList.toggle("active", mode === 0);
    document.getElementById("btn-mode-1").classList.toggle("active", mode === 1);
    document.getElementById("mode-0-fields").classList.toggle("hidden", mode !== 0);
    document.getElementById("mode-1-fields").classList.toggle("hidden", mode !== 1);

    const submitBtn = document.getElementById("btn-submit-reg");
    submitBtn.textContent = mode === 0 ? "WG gründen & starten 🏠" : "Anmelden & Beitreten 🔑";
    checkRegButton();
};

// Startet die Registrierung nachdem der Nutzer entschieden hat, ob er neu ist oder einer WG beitreten will
window.startRegistration = function (mode) {
    const intro = document.getElementById('reg-intro');
    const form = document.getElementById('registration-form');
    if (intro) intro.classList.add('hidden');
    if (form) form.classList.remove('hidden');
    // Wenn Nutzer bereits eine WG hat, zeigen wir direkt das Login (WG beitreten)
    const seg = document.querySelector('#registration-form .segmented-control');
    if (mode === 1) {
        // hide the segmented control once a path is chosen
        if (seg) seg.style.display = 'none';
        // ensure join-fields visible, create-fields hidden
        document.getElementById('mode-0-fields').classList.add('hidden');
        document.getElementById('mode-1-fields').classList.remove('hidden');
        activeRegistrationMode = 1;
        // show 'Daten vom Gerät verwenden' for join flow
        const fillBtn = document.getElementById('btn-fill-local'); if (fillBtn) fillBtn.style.display = '';
    } else {
        // hide the segmented control once a path is chosen
        if (seg) seg.style.display = 'none';
        document.getElementById('mode-0-fields').classList.remove('hidden');
        document.getElementById('mode-1-fields').classList.add('hidden');
        activeRegistrationMode = 0;
        // hide fill-from-local for create flow
        const fillBtn = document.getElementById('btn-fill-local'); if (fillBtn) fillBtn.style.display = 'none';
    }
    setRegMode(activeRegistrationMode);
};

window.backToIntro = function () {
    const intro = document.getElementById('reg-intro');
    const form = document.getElementById('registration-form');
    if (form) form.classList.add('hidden');
    if (intro) intro.classList.remove('hidden');
    // reset segmented control visibility and hide fill-local button
    const seg = document.querySelector('#registration-form .segmented-control');
    if (seg) seg.style.display = '';
    const fillBtn = document.getElementById('btn-fill-local'); if (fillBtn) fillBtn.style.display = '';
};

window.fillLocalData = function () {
    try {
        const saved = localStorage.getItem('roommood_user');
        if (!saved) {
            alert('Keine lokalen Profildaten gefunden.');
            return;
        }
        const u = JSON.parse(saved);
        if (u.name) document.getElementById('reg-username').value = u.name;
        if (u.homeCode) document.getElementById('reg-homecode').value = u.homeCode;
        // set mode to join
        startRegistration(1);
        setRegMode(1);
    } catch (e) {
        console.warn('fillLocalData error', e);
    }
};

function checkRegButton() {
    const name = document.getElementById("reg-username").value.trim();
    const homeName = document.getElementById("reg-homename").value.trim();
    const createPass = document.getElementById("reg-create-password").value.trim();
    const confirmPass = (document.getElementById("reg-create-password-confirm") && document.getElementById("reg-create-password-confirm").value) ? document.getElementById("reg-create-password-confirm").value.trim() : '';
    const code = document.getElementById("reg-homecode").value.trim();
    const joinPass = document.getElementById("reg-join-password").value.trim();

    if (activeRegistrationMode === 0) {
        // create mode: require confirm match
        const match = createPass && confirmPass && (createPass === confirmPass);
        const lengthOk = createPass && createPass.length >= 5;
        const valid = name && homeName && createPass && match && lengthOk;
        if (!lengthOk && createPass) showError('Passwort mindestens 5 Zeichen.');
        else if (!match && createPass && confirmPass) showError('Passwörter stimmen nicht überein.');
        else showError('');
        document.getElementById("btn-submit-reg").disabled = !valid;
    } else {
        const valid = name && code && joinPass;
        document.getElementById("btn-submit-reg").disabled = !valid;
        showError('');
    }
    // populate edit-chore-assignee if present
    const editChSel = document.getElementById('edit-chore-assignee');
    if (editChSel) {
        editChSel.innerHTML = '';
        (appData.members || []).forEach(m => {
            const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; editChSel.appendChild(o);
        });
    }
}

function showError(msg) {
    const errEl = document.getElementById("reg-error-msg");
    if (msg) {
        errEl.textContent = msg;
        errEl.style.display = "block";
    } else {
        errEl.style.display = "none";
    }
}

window.submitRegistration = async function () {
    showError("");
    const name = document.getElementById("reg-username").value.trim();
    appData.user.name = name;

    const myInitials = name.substring(0, 2).toUpperCase();
    const myMember = { name: name, initials: myInitials, color: "#364940" };

    // Falls ein Bild ausgewählt wurde, als Data-URL einlesen
    try {
        const imgInput = document.getElementById('reg-member-image');
        if (imgInput && imgInput.files && imgInput.files[0]) {
            const file = imgInput.files[0];
            myMember.image = await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(file);
            });
        }
    } catch (e) {
        console.warn('Bild konnte nicht geladen werden', e);
    }

    if (activeRegistrationMode === 0) {
        const homeName = document.getElementById("reg-homename").value.trim();
        const password = document.getElementById("reg-create-password").value.trim();
        const confirm = document.getElementById("reg-create-password-confirm").value.trim();

        if (!password || password.length < 5) { showError('Passwort muss mindestens 5 Zeichen haben.'); return; }
        if (password !== confirm) { showError('Passwörter stimmen nicht überein.'); return; }
        const generatedCode = "RM-" + Math.floor(1000 + Math.random() * 9000);

        appData.user.homeName = homeName;
        appData.user.homeCode = generatedCode;
        appData.members = [myMember];

        const homeRef = doc(db, "homes", generatedCode);
        await setDoc(homeRef, {
            homeName: homeName,
            password: password,
            members: appData.members,
            rooms: [],
            moodRooms: [],
            chores: [],
            tasks: [],
            shopping: [],
            events: []
        });

    } else {
        const code = document.getElementById("reg-homecode").value.trim().toUpperCase();
        const password = document.getElementById("reg-join-password").value.trim();

        const homeRef = doc(db, "homes", code);
        const docSnap = await getDoc(homeRef);

        if (!docSnap.exists()) {
            showError("WG-Code existiert nicht. Bitte überprüfen!");
            return;
        }

        const homeData = docSnap.data();
        if (homeData.password !== password) {
            showError("Falsches Passwort!");
            return;
        }

        appData.user.homeCode = code;
        appData.user.homeName = homeData.homeName;
        appData.members = homeData.members || [];

        if (!appData.members.some(m => m.name === name)) {
            appData.members.push(myMember);
            await setDoc(homeRef, { members: appData.members }, { merge: true });
        }
    }

    localStorage.setItem("roommood_user", JSON.stringify(appData.user));

    syncWithFirebase();
    document.getElementById("registration-page").classList.remove("active");
    showMainApp();
};

function showMainApp() {
    document.getElementById("main-app").classList.add("active");
    renderAllViews();
}

function renderAllViews() {
    // aktualisiere Member-Selects in Formularen
    populateMemberSelects();
    renderDashboard();
    renderChores();
    renderTasks();
    renderShopping();
    renderCalendar();
}

// Füllt Select-Elemente mit Mitgliedern (z.B. für Putzaufgaben-Zuweisung)
function populateMemberSelects() {
    const sel = document.getElementById('chore-assignee');
    if (!sel) return;
    // beibehalten: erste Option = Alle (value="")
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Alle';
    sel.appendChild(optAll);
    (appData.members || []).forEach(m => {
        const o = document.createElement('option');
        o.value = m.name;
        o.textContent = m.name;
        sel.appendChild(o);
    });
    // Make the select appear collapsed initially and expand on focus/click
    try {
        sel.size = 1; // collapsed
        sel.addEventListener('focus', () => { sel.size = Math.min(6, Math.max(1, sel.options.length)); });
        sel.addEventListener('click', () => { sel.size = Math.min(6, Math.max(1, sel.options.length)); });
        sel.addEventListener('blur', () => { sel.size = 1; });
    } catch (e) { /* ignore if not available */ }
    // Event-Member multi-select füllen
    const evt = document.getElementById('event-person');
    if (evt) {
        evt.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = '';
        optAll.textContent = 'Alle';
        evt.appendChild(optAll);
        (appData.members || []).forEach(m => {
            const o = document.createElement('option');
            o.value = m.name;
            o.textContent = m.name;
            evt.appendChild(o);
        });
        // collapsed until focus/click
        try {
            evt.size = 1;
            evt.addEventListener('focus', () => { evt.size = Math.min(6, Math.max(1, evt.options.length)); });
            evt.addEventListener('click', () => { evt.size = Math.min(6, Math.max(1, evt.options.length)); });
            evt.addEventListener('blur', () => { evt.size = 1; });
        } catch (e) { }
    }
    // also populate edit-event-person select if present
    const editEvt = document.getElementById('edit-event-person');
    if (editEvt) {
        editEvt.innerHTML = '';
        const optAll2 = document.createElement('option'); optAll2.value = ''; optAll2.textContent = 'Alle'; editEvt.appendChild(optAll2);
        (appData.members || []).forEach(m => {
            const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; editEvt.appendChild(o);
        });
        try {
            editEvt.size = 1;
            editEvt.addEventListener('focus', () => { editEvt.size = Math.min(6, Math.max(1, editEvt.options.length)); });
            editEvt.addEventListener('click', () => { editEvt.size = Math.min(6, Math.max(1, editEvt.options.length)); });
            editEvt.addEventListener('blur', () => { editEvt.size = 1; });
        } catch (e) { }
    }
}


// --- TABS & NAVIGATION ---
window.switchTab = function (tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add("active");
};

window.openModal = function (id) {
    const el = document.getElementById(id);
    if (!el) { console.debug('openModal: element not found', id); return; }
    try {
        // ensure modal is direct child of body so fixed positioning works and it's not clipped
        if (el.parentElement !== document.body) document.body.appendChild(el);
    } catch (e) { /* ignore */ }
    el.classList.add("active");
    try { document.body.classList.add('modal-open'); } catch (e) { }
    console.debug('openModal: opened', id, 'modal parent=', el.parentElement && el.parentElement.tagName);
};
window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
    // if no other modal is active, remove modal-open class
    try {
        const any = document.querySelectorAll('.modal.active');
        if (!any || any.length === 0) document.body.classList.remove('modal-open');
    } catch (e) { }
};

// --- DASHBOARD ---
function renderDashboard() {
    // show home name and code, append small roommood logo instead of house emoji
    try {
        const titleEl = document.getElementById('display-home-title');
        if (titleEl) {
            // safe fallbacks
            const homeName = appData.user && appData.user.homeName ? appData.user.homeName : 'Deine WG';
            const homeCode = appData.user && appData.user.homeCode ? appData.user.homeCode : '';

            // Update or create the title element
            try {
                // if the title element exists, update its text
                titleEl.textContent = `${escapeHtml(homeName)}${homeCode ? ' (' + escapeHtml(homeCode) + ')' : ''}`;
            } catch (e) {
                console.warn('could not set titleEl.textContent', e);
            }

            // keep #display-home-code in sync if it exists
            const codeSpan = document.getElementById('display-home-code');
            if (codeSpan) codeSpan.textContent = homeCode;

            // Ensure header shows logo to the right — do not remove other header children
            const headerEl = document.querySelector('.app-header');
            if (headerEl) {
                headerEl.style.display = headerEl.style.display || 'flex';
                headerEl.style.alignItems = 'center';
                headerEl.style.justifyContent = headerEl.style.justifyContent || 'space-between';

                // ensure a single title-logo exists at the end of header
                let logo = headerEl.querySelector('img.title-logo');
                if (!logo) {
                    // try to find any existing header-logo and reuse
                    const existing = headerEl.querySelector('img.header-logo');
                    if (existing) {
                        existing.classList.add('title-logo');
                        existing.classList.remove('header-logo');
                        logo = existing;
                    }
                }
                if (!logo) {
                    logo = document.createElement('img');
                    logo.src = 'roommoodlogo.png';
                    logo.alt = 'RoomMood';
                    logo.className = 'title-logo';
                    headerEl.appendChild(logo);
                }
            }
        }
    } catch (e) { console.warn('set title logo failed', e); }
    // Ensure members have initials and a color fallback; ensure emoji/status/location fields exist
    (appData.members || []).forEach((m, idx) => {
        if (!m.initials) {
            m.initials = (m.name || '??').split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase();
        }
        if (!m.color) {
            const palette = ['#FF6B6B', '#6BCB77', '#4D96FF', '#FFC75F', '#845EC2', '#00C9A7', '#FF9671', '#B86BFF'];
            m.color = palette[idx % palette.length];
        }
        if (!m.emoji) m.emoji = '😎';
        if (!m.status) m.status = '';
        if (!m.locEmoji) m.locEmoji = '🏠';
        if (!m.locText) m.locText = '';
    });
    const membersList = document.getElementById("members-list");
    // make members grid larger and responsive
    membersList.className = 'members-grid';
    membersList.innerHTML = (appData.members || []).map((m, i) => {
        const metaText = `${escapeHtml(m.emoji || '')} ${escapeHtml(m.status || '')} · ${escapeHtml(m.locEmoji || '')} ${escapeHtml(m.locText || '')}`;
        const rightAvatar = m.image ? `<img src="${m.image}" alt="${escapeHtml(m.name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : `<div style="width:48px;height:48px;border-radius:50%;background:${m.color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml(m.initials)}</div>`;
        return `
    <div class="member-avatar large" style="padding:12px; width:100%; display:flex; flex-direction:row; align-items:center; gap:12px;" data-title="${metaText}">
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span class="member-name" style="font-size:0.98rem; font-weight:700; color:var(--primary-color);">${escapeHtml(m.name)}</span>
          ${m.name === appData.user.name ? `<button class="edit-btn" title="Profil bearbeiten" onclick="openEditMember(${i})">✏️</button>` : ''}
        </div>
         <div style="margin-top:6px; font-size:0.9rem; color:var(--text-muted); display:flex; gap:8px; align-items:center;">
           <span class="member-emoji">${escapeHtml(m.emoji || '')}</span>
           <span class="member-status">${escapeHtml(m.status || '')}</span>
           <span class="member-loc" style="margin-left:6px;">${escapeHtml(m.locEmoji || '')} ${escapeHtml(m.locText || '')}</span>
         </div>
      </div>
      <div style="flex:0 0 auto;">
        ${rightAvatar}
      </div>
      <input type="file" id="member-image-${i}" accept="image/*" style="display:none;" onchange="handleMemberImageChange(event, ${i})">
    </div>
  `;
    }).join("");

    document.getElementById("my-vibe-name").textContent = appData.user.name;
    document.getElementById("my-vibe-emoji").textContent = appData.user.emoji;
    document.getElementById("my-vibe-status").textContent = appData.user.status;
    document.getElementById("my-vibe-location").textContent = `${appData.user.locEmoji} ${appData.user.locText}`;

    const pRooms = document.getElementById("physical-rooms-list");
    pRooms.innerHTML = appData.rooms.length === 0 ? '<p style="color:gray; font-size:0.85rem;">Noch keine Räume angelegt.</p>' : appData.rooms.map(r => `
    <div class="room-item card">
      <div class="room-icon">${r.icon}</div>
      <div style="flex:1; margin-right:8px;">
        <strong>${r.name}</strong>
        <p style="font-size:0.8rem; color:gray;">Zustand: ${r.cleanliness}</p>
        ${r.comment ? `<p style="font-size:0.75rem; font-style:italic;">„${r.comment}“</p>` : ''}
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="btn-secondary" style="padding:8px 10px;" onclick="openEditRoom(${r.id})">Bearbeiten</button>
        <button class="btn-link" style="color:#e74c3c; background:none; border:none; cursor:pointer;" onclick="deleteRoom(${r.id})">Löschen</button>
      </div>
    </div>
  `).join("");

    const mRooms = document.getElementById("mood-rooms-list");
    mRooms.innerHTML = appData.moodRooms.length === 0 ? '<p style="color:gray; font-size:0.85rem;">Noch keine Vibe-Räume angelegt.</p>' : appData.moodRooms.map(mr => `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${mr.name}</strong>
          <p style="font-size:0.85rem; color:gray; margin:4px 0 0 0;">${mr.note}</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-secondary" onclick="openEditMoodRoom(${mr.id})">Bearbeiten</button>
          <button class="btn-link" style="color:#e74c3c; background:none; border:none; cursor:pointer;" onclick="deleteMoodRoom(${mr.id})">Löschen</button>
        </div>
      </div>
      <div style="margin: 8px 0; font-size: 0.8rem;">
        ${(mr.moods || []).map(m => `<div>• ${m.name}:${m.emoji}</div>`).join("")}
      </div>
      <button class="btn-secondary" style="width:100%; font-size:0.8rem;" onclick="openExpressMood(${mr.id})">Gefühl ausdrücken</button>
    </div>
  `).join("");
}

window.saveVibe = function () {
    appData.user.emoji = document.getElementById("edit-emoji-select").value;
    appData.user.status = document.getElementById("edit-status-input").value || "Entspannt";
    appData.user.locEmoji = document.getElementById("edit-loc-emoji-select").value;
    appData.user.locText = document.getElementById("edit-loc-text-input").value || "Zuhause";
    localStorage.setItem("roommood_user", JSON.stringify(appData.user));
    // also update the corresponding member entry for the current user so hover shows updated info
    const myName = appData.user.name;
    const me = (appData.members || []).find(m => m.name === myName);
    if (me) {
        me.emoji = appData.user.emoji;
        me.status = appData.user.status;
        me.locEmoji = appData.user.locEmoji;
        me.locText = appData.user.locText;
        // persist member changes to firebase
        saveToFirebase();
    }
    renderDashboard();
    closeModal("edit-mood-modal");
};

window.addRoom = function () {
    const name = document.getElementById("new-room-name").value.trim();
    if (!name) return;
    appData.rooms.push({
        id: Date.now(),
        name: name,
        cleanliness: document.getElementById("new-room-cleanliness").value || "Sauber",
        comment: document.getElementById("new-room-comment").value,
        icon: "🏠"
    });
    saveToFirebase(); closeModal("add-room-modal");
    document.getElementById("new-room-name").value = "";
};

window.addMoodRoom = function () {
    const name = document.getElementById("new-moodroom-name").value.trim();
    if (!name) return;
    appData.moodRooms.push({
        id: Date.now(),
        name: name,
        note: document.getElementById("new-moodroom-note").value,
        moods: []
    });
    saveToFirebase(); closeModal("add-moodroom-modal");
    document.getElementById("new-moodroom-name").value = "";
};

window.openExpressMood = function (id) {
    targetMoodRoomId = id;
    openModal("express-mood-modal");
};

window.saveExpressMood = function () {
    const selectedEmoji = document.getElementById("express-emoji-select").value;
    const room = appData.moodRooms.find(r => r.id === targetMoodRoomId);
    if (room) {
        if (!room.moods) room.moods = [];
        const existing = room.moods.find(m => m.name === appData.user.name);
        if (existing) existing.emoji = selectedEmoji;
        else room.moods.push({ name: appData.user.name, emoji: selectedEmoji });
        saveToFirebase();
    }
    closeModal("express-mood-modal");
};

// --- TO-DOS & PUTZPLAN ---
window.setTodoSegment = function (segment) {
    document.getElementById("btn-todo-0").classList.toggle("active", segment === 0);
    document.getElementById("btn-todo-1").classList.toggle("active", segment === 1);
    document.getElementById("segment-chores").classList.toggle("hidden", segment !== 0);
    document.getElementById("segment-tasks").classList.toggle("hidden", segment !== 1);
};

function renderChores() {
    const list = document.getElementById("chores-list");
    if (appData.chores.length === 0) {
        list.innerHTML = '<p style="color:gray; font-size:0.85rem; margin-top:10px;">Keine Putzaufgaben vorhanden.</p>';
        return;
    }
    list.innerHTML = appData.chores.map(c => {
        const assignees = c.assignees && Array.isArray(c.assignees) && c.assignees.length ? c.assignees.join(', ') : 'Alle';
        let overdueHtml = '';
        if (c.dueDate) {
            const due = new Date(c.dueDate + 'T00:00:00');
            const now = new Date();
            const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
            if (diff > 0) overdueHtml = `<span style="color:#e74c3c; font-size:0.85rem; margin-right:8px;">⚠️ ${diff} Tage überfällig</span>`;
        }
        // show avatar (image or initials) for assigned members if single assignee
        let avatarHtml = '';
        if (c.assignees && Array.isArray(c.assignees) && c.assignees.length === 1) {
            const m = appData.members.find(mm => mm.name === c.assignees[0]);
            if (m) {
                if (m.image) avatarHtml = `<img src="${m.image}" alt="${escapeHtml(m.name)}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;margin-right:8px;">`;
                else avatarHtml = `<div style="width:28px;height:28px;border-radius:6px;background:${m.color};color:white;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;font-size:0.8rem;">${escapeHtml(m.initials || m.name.slice(0, 2).toUpperCase())}</div>`;
            }
        }

        return `
    <li class="${c.done ? 'done' : ''}">
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleChore(${c.id})">
          ${avatarHtml}
          <div>
            <div style="font-weight:600;">${escapeHtml(c.title)}</div>
            <div style="font-size:0.75rem; color:gray;">${escapeHtml(assignees)} • ${escapeHtml(c.frequency || '')} ${c.dueDate ? '• Fällig: ' + escapeHtml(c.dueDate) : ''}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${overdueHtml}
          <button class="btn-link chore-edit-btn" data-id="${c.id}">Bearbeiten</button>
          <button class="btn-link chore-delete-btn" data-id="${c.id}" style="color:#e74c3c;">Löschen</button>
        </div>
      </div>
    </li>`;
    }).join("");

    // attach event listeners to the buttons created via innerHTML
    try {
        const editBtns = Array.from(document.querySelectorAll('.chore-edit-btn'));
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                const id = Number(btn.getAttribute('data-id'));
                console.debug('chore-edit-btn clicked, id=', id, 'btn=', btn);
                if (!isNaN(id)) window.openEditChore(id);
            });
        });
        console.debug('renderChores: attached listeners, editBtnsCount=', editBtns.length);
        document.querySelectorAll('.chore-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(btn.getAttribute('data-id'));
                if (!isNaN(id)) { e.stopPropagation(); deleteChore(id); }
            });
        });
    } catch (e) { }

    // Setup delegated click handler on parent as a fallback to catch any missed buttons
    try {
        const parent = document.getElementById('chores-list');
        if (parent && !parent.dataset.delegation) {
            parent.addEventListener('click', (ev) => {
                const btn = ev.target.closest && ev.target.closest('.chore-edit-btn');
                if (!btn) return;
                ev.preventDefault(); ev.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                console.debug('delegated click on chore-edit-btn id=', id);
                if (!isNaN(id)) window.openEditChore(id);
            });
            parent.dataset.delegation = '1';
        }
    } catch (e) { }
}

window.addChore = function () {
    const titleInput = document.getElementById("chore-title");
    const title = titleInput.value.trim();
    if (!title) return;

    // Lese mehrere ausgewählte Mitglieder
    const sel = document.getElementById('chore-assignee');
    let assignees = [];
    if (sel) {
        assignees = Array.from(sel.selectedOptions).map(o => o.value).filter(v => v !== null && v !== undefined && v !== '');
    }

    appData.chores.push({
        id: Date.now(),
        title: title,
        assignees: assignees, // leeres Array = Alle
        frequency: document.getElementById("chore-freq").value,
        dueDate: document.getElementById('chore-duedate') ? document.getElementById('chore-duedate').value : null,
        done: false
    });

    titleInput.value = "";
    if (sel) sel.selectedIndex = -1;
    if (document.getElementById('chore-duedate')) document.getElementById('chore-duedate').value = '';
    saveToFirebase();
    renderChores();
};

// Send feedback message to Firestore (collection 'feedback')
window.sendFeedback = async function () {
    const ta = document.getElementById('feedback-text');
    if (!ta) return alert('Feedback-Formular nicht gefunden.');
    const msg = (ta.value || '').trim();
    if (!msg) return alert('Bitte eine Nachricht eingeben.');
    const id = 'fb-' + Date.now();
    try {
        await setDoc(doc(db, 'feedback', id), {
            homeCode: appData.user && appData.user.homeCode ? appData.user.homeCode : null,
            user: appData.user && appData.user.name ? appData.user.name : null,
            message: msg,
            createdAt: new Date().toISOString()
        });
        ta.value = '';
        alert('Danke für dein Feedback!');
        closeModal('feedback-modal');
    } catch (e) {
        console.error('feedback send error', e);
        alert('Fehler beim Senden des Feedbacks.');
    }
};

// Auto-close modal after save/abort buttons to avoid bottom-nav overlap
document.addEventListener('click', (e) => {
    try {
        const btn = e.target.closest && e.target.closest('button');
        if (!btn) return;
        const modal = btn.closest && btn.closest('.modal');
        if (!modal) return;
        const onclick = (btn.getAttribute && btn.getAttribute('onclick')) || '';
        const text = (btn.textContent || '').trim().toLowerCase();
        const isSave = onclick.toLowerCase().includes('save') || text.includes('speichern') || btn.classList.contains('btn-primary');
        const isCancel = onclick.toLowerCase().includes('closemodal') || text.includes('abbrechen') || btn.classList.contains('btn-secondary');
        if (isSave || isCancel) {
            // allow the save handler to run, then ensure modal closed
            setTimeout(() => {
                try {
                    if (modal.classList.contains('active')) closeModal(modal.id);
                } catch (e) { }
            }, 80);
        }
    } catch (e) { }
});

window.toggleChore = function (id) {
    const item = appData.chores.find(c => c.id === id);
    if (item) { item.done = !item.done; saveToFirebase(); }
};

window.deleteChore = function (id) {
    appData.chores = appData.chores.filter(c => c.id !== id);
    saveToFirebase();
    renderChores();
};

// open modal-based edit for chore
window.openEditChore = function (id) {
    console.debug('openEditChore called with id=', id);
    const chore = (appData.chores || []).find(c => c.id === id);
    if (!chore) { console.debug('openEditChore: chore not found', id); return; }
    editingChoreId = id;
    // ensure the select is populated (in case members changed)
    const sel = document.getElementById('edit-chore-assignee');
    if (sel) {
        sel.innerHTML = '';
        (appData.members || []).forEach(m => {
            const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; sel.appendChild(o);
        });
    }
    document.getElementById('edit-chore-title').value = chore.title || '';
    document.getElementById('edit-chore-duedate').value = chore.dueDate || '';
    document.getElementById('edit-chore-freq').value = chore.frequency || 'Wöchentlich';
    // set assignees selection
    if (sel) {
        Array.from(sel.options).forEach(o => { o.selected = (chore.assignees || []).includes(o.value); });
    }
    // ensure modal element exists and has high z-index, then open
    const modalEl = document.getElementById('edit-chore-modal');
    if (!modalEl) { console.debug('openEditChore: modal element not found'); return; }
    openModal('edit-chore-modal');
    // after a tiny delay ensure it is visible and focus
    setTimeout(() => {
        try { modalEl.classList.add('active'); document.body.classList.add('modal-open'); } catch (e) { }
        try { const t = document.getElementById('edit-chore-title'); if (t) t.focus(); } catch (e) { }
        console.debug('openEditChore: modal opened', modalEl.classList.toString());
    }, 40);
};

window.saveEditChore = function () {
    if (!editingChoreId) return;
    const chore = (appData.chores || []).find(c => c.id === editingChoreId);
    if (!chore) return;
    chore.title = document.getElementById('edit-chore-title').value.trim() || chore.title;
    chore.dueDate = document.getElementById('edit-chore-duedate').value || null;
    chore.frequency = document.getElementById('edit-chore-freq').value || chore.frequency;
    const sel = document.getElementById('edit-chore-assignee');
    if (sel) chore.assignees = Array.from(sel.selectedOptions).map(o => o.value).filter(v => v);
    saveToFirebase();
    // close modal after save
    closeModal('edit-chore-modal');
    editingChoreId = null;
    renderChores();
};

function renderTasks() {
    const list = document.getElementById("tasks-list");
    if (appData.tasks.length === 0) {
        list.innerHTML = '<p style="color:gray; font-size:0.85rem; margin-top:10px;">Keine Aufgaben vorhanden.</p>';
        return;
    }
    list.innerHTML = appData.tasks.map(t => {
        // compute overdue similar to chores
        let overdueHtml = '';
        if (t.date) {
            const due = new Date(t.date + 'T00:00:00');
            const now = new Date();
            const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
            if (diff > 0 && !t.done) overdueHtml = `<span style="color:#e74c3c; font-size:0.85rem; margin-right:8px;">⚠️ ${diff} Tage überfällig</span>`;
        }
        return `
    <li class="${t.done ? 'done' : ''}">
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
        <div>
          <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})">
          <span style="margin-left: 8px;">${escapeHtml(t.title)}</span>
          <div style="font-size:0.75rem; color:gray; margin-left: 24px;">🗓️ Fällig: ${t.date || 'Kein Datum'}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${overdueHtml}
          <button class="btn-link" style="color:#e74c3c; background:none; border:none; cursor:pointer;" onclick="deleteTask(${t.id})">🗑️</button>
        </div>
      </div>
    </li>
  `;
    }).join("");

    // Attach handlers for edit/delete buttons created in innerHTML
    try {
        document.querySelectorAll('.chore-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                if (!isNaN(id)) window.openEditChore(id);
            });
        });
        document.querySelectorAll('.chore-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.getAttribute('data-id'));
                if (!isNaN(id)) deleteChore(id);
            });
        });
    } catch (e) { console.warn('attach chore handlers', e); }
}

window.addTask = function () {
    const titleInput = document.getElementById("task-title");
    const title = titleInput.value.trim();
    if (!title) return;

    appData.tasks.push({
        id: Date.now(),
        title: title,
        date: document.getElementById("task-date").value || "",
        done: false
    });

    titleInput.value = "";
    document.getElementById("task-date").value = "";
    saveToFirebase();
};

window.toggleTask = function (id) {
    const item = appData.tasks.find(t => t.id === id);
    if (item) { item.done = !item.done; saveToFirebase(); }
};

window.deleteTask = function (id) {
    appData.tasks = appData.tasks.filter(t => t.id !== id);
    saveToFirebase();
};

// --- EINKAUFSLISTE ---
// Die eigentliche Implementierung mit Drag&Drop befindet sich in renderShoppingImpl/addShoppingItem etc.
function renderShopping() {
    if (typeof renderShoppingImpl === 'function') return renderShoppingImpl();
    // Fallback: einfache Darstellung
    const list = document.getElementById("shopping-list");
    if (!list) return;
    if (!appData.shopping || appData.shopping.length === 0) {
        list.innerHTML = '<p style="color:gray; font-size:0.85rem; margin-top:10px;">Einkaufsliste ist leer.</p>';
        return;
    }
    list.innerHTML = appData.shopping.map(s => `
    <li class="${s.done ? 'done' : ''}">
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
        <div>
          <input type="checkbox" ${s.done ? 'checked' : ''} onchange="(toggleShoppingDone||(()=>{}))(${s.id})">
          <span style="margin-left: 8px;">${escapeHtml(s.title)}</span>
        </div>
        <button class="btn-link" style="color:#e74c3c; background:none; border:none; cursor:pointer;" onclick="(deleteShoppingItem||(()=>{}))(${s.id})">🗑️</button>
      </div>
    </li>
  `).join("");
}

// Ensure global bindings exist for legacy names
if (!window.addShoppingItem && typeof addShoppingItem === 'function') window.addShoppingItem = addShoppingItem;
if (!window.toggleShopping && typeof toggleShoppingDone === 'function') window.toggleShopping = toggleShoppingDone;
if (!window.deleteShopping && typeof deleteShoppingItem === 'function') window.deleteShopping = deleteShoppingItem;

// Drag & drop for the shopping list: only the ☰ handle starts a drag (pointer events,
// works for mouse + touch), so the rest of the item scrolls and taps normally.
function renderShoppingImpl() {
    const list = document.getElementById('shopping-list');
    if (!list) return;
    if (!appData.shopping || appData.shopping.length === 0) {
        list.innerHTML = '<p style="color:gray; font-size:0.85rem; margin-top:10px;">Keine Einträge.</p>';
        return;
    }

    list.innerHTML = appData.shopping.map(item => `
    <li class="shopping-item ${item.done ? 'done' : ''}" data-id="${item.id}">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="display:flex; gap:10px; align-items:center; flex:1; overflow:hidden;">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="(toggleShoppingDone||(()=>{}))(${item.id})">
          <span style="min-width:0;">${escapeHtml(item.title)}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-link" onclick="(deleteShoppingItem||(()=>{}))(${item.id})" style="color:#e74c3c;">Löschen</button>
          <span class="drag-handle" aria-label="Verschieben" style="padding:6px 8px; cursor:grab;">☰</span>
        </div>
      </div>
    </li>
  `).join('');

    // Attach drag listeners only once per list element (renderShopping runs often)
    if (list.dataset.dragBound) return;
    list.dataset.dragBound = '1';

    let dragEl = null;
    let pointerId = null;

    list.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest && e.target.closest('.drag-handle');
        if (!handle) return;
        const li = handle.closest('.shopping-item');
        if (!li) return;
        e.preventDefault();
        dragEl = li;
        pointerId = e.pointerId;
        try { handle.setPointerCapture(e.pointerId); } catch (err) { }
        li.classList.add('dragging');
    });

    list.addEventListener('pointermove', (e) => {
        if (!dragEl || e.pointerId !== pointerId) return;
        e.preventDefault();
        const y = e.clientY;
        const others = Array.from(list.querySelectorAll('.shopping-item')).filter(x => x !== dragEl);
        const before = others.find(it => {
            const r = it.getBoundingClientRect();
            return y < r.top + r.height / 2;
        });
        if (before) { if (dragEl.nextSibling !== before) list.insertBefore(dragEl, before); }
        else if (list.lastElementChild !== dragEl) list.appendChild(dragEl);
    });

    function endDrag(e) {
        if (!dragEl || (e && e.pointerId !== pointerId)) return;
        dragEl.classList.remove('dragging');
        dragEl = null;
        pointerId = null;
        const order = Array.from(list.querySelectorAll('.shopping-item')).map(li => li.getAttribute('data-id'));
        const current = (appData.shopping || []).map(s => String(s.id));
        if (order.join(',') === current.join(',')) return;
        const byId = new Map((appData.shopping || []).map(s => [String(s.id), s]));
        appData.shopping = order.map(id => byId.get(id)).filter(Boolean);
        saveToFirebase();
        renderShopping();
    }
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
}

// ensure addShoppingItem global binding uses our behavior
window.addShoppingItem = function () {
    const input = document.getElementById('shopping-input');
    if (!input) return;
    const title = (input.value || '').trim();
    if (!title) return;
    if (!appData.shopping) appData.shopping = [];
    appData.shopping.push({ id: Date.now(), title: title, done: false });
    input.value = '';
    saveToFirebase();
    renderShopping();
};

// expose reorder helper too
window.reorderShopping = function (srcId, targetId) {
    if (!appData.shopping) return;
    const arr = appData.shopping;
    const srcIndex = arr.findIndex(i => String(i.id) === String(srcId));
    const targetIndex = arr.findIndex(i => String(i.id) === String(targetId));
    if (srcIndex === -1 || targetIndex === -1) return;
    const [item] = arr.splice(srcIndex, 1);
    const insertIndex = srcIndex < targetIndex ? targetIndex : targetIndex;
    arr.splice(insertIndex, 0, item);
    saveToFirebase();
    renderShopping();
};

// --- KALENDER ---
function renderCalendar() {
    const monthTitle = currentCalDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    document.getElementById("cal-month-title").textContent = monthTitle;
    const grid = document.getElementById("calendar-days-grid");
    grid.innerHTML = "";

    // Render calendar from Monday to Sunday
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // JS: 0=Sun,1=Mon,.. shift so Monday=0
    const shift = (firstOfMonth.getDay() + 6) % 7; // number of blank days before day 1
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // add blank placeholders for days of previous month to align Monday start
    for (let b = 0; b < shift; b++) {
        const empty = document.createElement('div'); empty.className = 'cal-day empty'; empty.innerHTML = '';
        grid.appendChild(empty);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const eventsOnDay = (appData.events || []).filter(e => e.start <= dayStr && e.end >= dayStr);
        const dayEl = document.createElement("div");
        dayEl.className = "cal-day";
        // build one or more color stripes for the day: one per event/person (max 4) so multiple participants/events are visible
        let barHtml = '';
        if (eventsOnDay.length > 0) {
            const bars = [];
            const maxBars = 4;
            for (let ei = 0; ei < eventsOnDay.length && bars.length < maxBars; ei++) {
                const ev = eventsOnDay[ei];
                // prefer explicit persons array, fall back to single person field
                const persons = (ev.persons && Array.isArray(ev.persons) && ev.persons.length) ? ev.persons : (ev.person ? [ev.person] : []);
                if (persons.length > 0) {
                    for (let pi = 0; pi < persons.length && bars.length < maxBars; pi++) {
                        const personName = persons[pi];
                        let color = '#364940';
                        if (personName) {
                            const m = (appData.members || []).find(mm => mm.name === personName);
                            if (m && m.color) color = m.color;
                        }
                        bars.push(`<div class="event-bar" style="background:${color};"></div>`);
                    }
                } else {
                    // no persons assigned -> use event color if present or default
                    const color = ev.color || '#364940';
                    bars.push(`<div class="event-bar" style="background:${color};"></div>`);
                }
            }
            if (bars.length) barHtml = `<div class="event-bars">${bars.join('')}</div>`;
            // set tooltip with up to 3 event titles
            const titles = eventsOnDay.map(ev2 => ev2.title).filter(Boolean).slice(0, 3).join(' • ');
            dayEl.title = titles;
        }
        dayEl.innerHTML = `<span>${i}</span>${barHtml}`;
        dayEl.onclick = () => { selectedCalDate = new Date(year, month, i); renderCalendarEvents(); };
        grid.appendChild(dayEl);
    }

    renderCalendarEvents();

    // initialize swipe gestures for mobile month change (only once)
    try {
        if (!calendarSwipeInitialized) {
            const grid = document.getElementById('calendar-days-grid');
            if (grid) {
                let startX = null;
                grid.addEventListener('touchstart', (e) => {
                    startX = e.touches && e.touches[0] && e.touches[0].clientX ? e.touches[0].clientX : null;
                }, { passive: true });
                grid.addEventListener('touchend', (e) => {
                    if (startX === null) return;
                    const endX = e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX ? e.changedTouches[0].clientX : null;
                    if (endX === null) return;
                    const dx = endX - startX;
                    const threshold = 40; // px
                    if (dx > threshold) {
                        // swipe right -> previous month
                        changeMonth(-1);
                    } else if (dx < -threshold) {
                        // swipe left -> next month
                        changeMonth(1);
                    }
                    startX = null;
                }, { passive: true });
                calendarSwipeInitialized = true;
            }
        }
    } catch (e) { console.warn('init calendar swipe failed', e); }
}

window.changeMonth = function (delta) {
    try {
        const grid = document.querySelector('.cal-grid');
        if (grid) {
            // add exit animation class based on direction
            if (delta > 0) grid.classList.add('slide-left-out');
            else grid.classList.add('slide-right-out');
            setTimeout(() => {
                currentCalDate.setMonth(currentCalDate.getMonth() + delta);
                renderCalendar();
                // after re-render add enter class for subtle animation
                const newGrid = document.querySelector('.cal-grid');
                if (newGrid) {
                    if (delta > 0) {
                        newGrid.classList.remove('slide-left-out');
                        newGrid.classList.add('slide-left-in');
                    } else {
                        newGrid.classList.remove('slide-right-out');
                        newGrid.classList.add('slide-right-in');
                    }
                    setTimeout(() => {
                        newGrid.classList.remove('slide-left-in');
                        newGrid.classList.remove('slide-right-in');
                    }, 260);
                }
            }, 160);
        } else {
            currentCalDate.setMonth(currentCalDate.getMonth() + delta);
            renderCalendar();
        }
    } catch (e) { currentCalDate.setMonth(currentCalDate.getMonth() + delta); renderCalendar(); }
};

function renderCalendarEvents() {
    const list = document.getElementById("calendar-events-list");
    if (appData.events.length === 0) {
        list.innerHTML = '<p style="color:gray; font-size:0.85rem;">Keine Termine eingetragen.</p>';
        return;
    }
    // Split events into upcoming/current and past
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = (appData.events || []).filter(e => e.end >= todayStr);
    const past = (appData.events || []).filter(e => e.end < todayStr);

    // Render upcoming/current events
    list.innerHTML = upcoming.map(e => {
        const persons = e.persons && Array.isArray(e.persons) ? (e.persons.length ? e.persons.join(', ') : 'Alle') : (e.person || 'Alle');
        // determine color from first assigned member if available (support e.person or e.persons)
        let color = '#364940';
        const firstAssigned = (e.persons && Array.isArray(e.persons) && e.persons.length) ? e.persons[0] : (e.person || null);
        if (firstAssigned) {
            const first = appData.members.find(m => m.name === firstAssigned);
            if (first && first.color) color = first.color;
        }
        const repeatLabel = e.repeat === 'yearly' ? ' (jährlich)' : '';
        // build avatars HTML for multiple assigned persons (show up to 3 photos/initials)
        let avatarsHtml = '';
        const personsArr = (e.persons && Array.isArray(e.persons) && e.persons.length) ? e.persons : (e.person ? [e.person] : []);
        if (personsArr.length) {
            const visible = personsArr.slice(0, 3);
            // add overlap class so avatars overlap visually
            avatarsHtml = '<div class="cal-event-avatars overlap">';
            visible.forEach(pname => {
                const fm = appData.members.find(m => m.name === pname);
                if (fm) {
                    if (fm.image) avatarsHtml += `<img src="${fm.image}" alt="${escapeHtml(fm.name)}" class="cal-avatar-img">`;
                    else avatarsHtml += `<div class="cal-avatar-initials" style="background:${fm.color};">${escapeHtml(fm.initials || fm.name.slice(0, 2).toUpperCase())}</div>`;
                } else {
                    avatarsHtml += `<div class="cal-avatar-initials" style="background:#cccccc;">${escapeHtml(pname.slice(0, 2).toUpperCase())}</div>`;
                }
            });
            if (personsArr.length > 3) avatarsHtml += `<div class="cal-avatar-more">+${personsArr.length - 3}</div>`;
            avatarsHtml += '</div>';
        }

        // build small color dots for each participant (show up to 3)
        let dotsHtml = '';
        if (personsArr.length) {
            const visibleDots = personsArr.slice(0, 3);
            dotsHtml = '<div class="cal-event-dots">';
            visibleDots.forEach(pname => {
                const m = appData.members.find(mm => mm.name === pname);
                const dotColor = (m && m.color) ? m.color : '#364940';
                dotsHtml += `<div class="cal-event-dot" style="background:${dotColor};"></div>`;
            });
            dotsHtml += '</div>';
        }

        return `
    <li class="cal-event-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-radius:6px; background:rgba(0,0,0,0.02); margin-bottom:6px;">
      <div title="${escapeHtml(e.title)} — ${e.start} bis ${e.end} — ${escapeHtml(persons)}" style="display:flex; gap:10px; align-items:center; flex:1;">
        ${dotsHtml}
        ${avatarsHtml}
        <div style="flex:1; cursor:pointer;" data-event-id="${e.id}">
          <strong>${escapeHtml(e.title)}${repeatLabel}</strong>
          <div style="font-size:0.75rem; color:gray;">${escapeHtml(persons)} | ${e.start} bis ${e.end}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-left:8px;">
        <button class="btn-link cal-edit-btn" data-id="${e.id}" style="font-size:0.9rem;">Bearbeiten</button>
        <button class="btn-link cal-delete-btn" data-id="${e.id}" style="font-size:0.9rem; color:#e74c3c;">Löschen</button>
      </div>
    </li>`;
    }).join("");

    // attach event listeners for edit/delete buttons (buttons are created via innerHTML)
    try {
        document.querySelectorAll('.cal-edit-btn').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation(); ev.preventDefault();
                const id = Number(btn.getAttribute('data-id'));
                console.debug('cal-edit-btn clicked id=', id);
                if (!isNaN(id)) window.openEditEvent(id);
            });
        });
        document.querySelectorAll('.cal-delete-btn').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation(); ev.preventDefault();
                const id = Number(btn.getAttribute('data-id'));
                if (!isNaN(id)) deleteEvent(id);
            });
        });
    } catch (e) { }

    // Render past events grouped by year -> month inside collapsible
    const pastContainer = document.getElementById('past-events-content');
    if (pastContainer) {
        if (past.length === 0) {
            pastContainer.innerHTML = '<p style="color:gray; font-size:0.85rem;">Keine vergangenen Termine.</p>';
        } else {
            // group by year then month
            const grouped = {};
            past.forEach(ev => {
                const y = new Date(ev.end).getFullYear();
                const m = new Date(ev.end).toLocaleString('de-DE', { month: 'long' });
                grouped[y] = grouped[y] || {};
                grouped[y][m] = grouped[y][m] || [];
                grouped[y][m].push(ev);
            });
            // produce HTML: year accordion, inside months accordion
            let html = '';
            Object.keys(grouped).sort((a, b) => b - a).forEach(year => {
                html += `<div class="past-year"><button class="btn-link" aria-expanded="false" onclick="toggleYear('${year}')">${year}</button><div id="year-${year}" class="hidden" style="margin-left:8px;">`;
                Object.keys(grouped[year]).sort((a, b) => new Date(a + ' 1') - new Date(b + ' 1')).forEach(month => {
                    const id = `month-${year}-${month}`.replace(/\s+/g, '-');
                    html += `<div><button class="btn-link" aria-expanded="false" onclick="toggleMonth('${id}')">${month}</button><div id="${id}" class="hidden" style="margin-left:12px;">`;
                    grouped[year][month].forEach(ev => {
                        html += `<div style="padding:6px 0; border-bottom:1px solid #eee;">${escapeHtml(ev.title)} — ${ev.start} bis ${ev.end}</div>`;
                    });
                    html += `</div></div>`;
                });
                html += `</div></div>`;
            });
            pastContainer.innerHTML = html;
        }
    }
}

window.togglePastEvents = function () {
    const c = document.getElementById('past-events-content');
    if (!c) return; c.classList.toggle('hidden');
};

window.toggleYear = function (year) {
    const el = document.getElementById(`year-${year}`);
    if (el) el.classList.toggle('hidden');
};

window.toggleMonth = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
};

// enhance toggles to set aria-expanded and change caret
function setExpanded(button, expanded) {
    try { button.setAttribute('aria-expanded', expanded ? 'true' : 'false'); } catch (e) { }
}

window.togglePastEvents = function () {
    const btn = document.getElementById('past-events-toggle');
    const c = document.getElementById('past-events-content');
    if (!c || !btn) return;
    const now = c.classList.toggle('hidden');
    setExpanded(btn, !now);
};

window.toggleYear = function (year) {
    const btn = document.querySelector(`button[onclick="toggleYear('${year}')"]`);
    const el = document.getElementById(`year-${year}`);
    if (!el) return; const now = el.classList.toggle('hidden'); if (btn) setExpanded(btn, !now);
};

window.toggleMonth = function (id) {
    const btn = document.querySelector(`button[onclick="toggleMonth('${id}')"]`);
    const el = document.getElementById(id);
    if (!el) return; const now = el.classList.toggle('hidden'); if (btn) setExpanded(btn, !now);
};

// simple HTML escape for titles/persons
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (s) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s];
    });
}

// Edit and delete handlers for events (prompt-based)
window.openEditEvent = function (id) {
    // Open a modal-like edit flow similar to chores
    const ev = (appData.events || []).find(e => e.id === id);
    if (!ev) return;
    editingEventId = id;
    // populate edit-event-modal fields (we have modal markup for add/edit)
    const titleEl = document.getElementById('edit-event-title');
    const personSel = document.getElementById('edit-event-person');
    const startEl = document.getElementById('edit-event-start');
    const endEl = document.getElementById('edit-event-end');
    if (personSel) {
        personSel.innerHTML = '';
        const optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = 'Alle'; personSel.appendChild(optAll);
        (appData.members || []).forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; personSel.appendChild(o); });
    }
    if (titleEl) titleEl.value = ev.title || '';
    if (startEl) startEl.value = ev.start || '';
    if (endEl) endEl.value = ev.end || '';
    if (personSel && ev.persons && Array.isArray(ev.persons)) {
        Array.from(personSel.options).forEach(o => { o.selected = (ev.persons || []).includes(o.value); });
    }
    openModal('edit-event-modal');
};

window.deleteEvent = function (id) {
    if (!confirm('Termin wirklich löschen?')) return;
    appData.events = (appData.events || []).filter(e => e.id !== id);
    saveToFirebase();
    renderCalendar();
};

window.addCalendarEvent = function () {
    const title = document.getElementById("event-title").value.trim();
    if (!title) return;
    // Personen aus Multi-Select lesen
    const evtSel = document.getElementById('event-person');
    let persons = [];
    if (evtSel) {
        const selected = Array.from(evtSel.selectedOptions).map(o => o.value).filter(v => v !== null && v !== undefined && v !== '');
        if (selected.length === 0) persons = [];
        else persons = selected;
    }

    const newEvent = {
        id: Date.now(),
        title: title,
        persons: persons,
        start: document.getElementById("event-start").value || new Date().toISOString().split('T')[0],
        end: document.getElementById("event-end").value || new Date().toISOString().split('T')[0]
    };

    // support yearly repetition flag if checkbox exists
    const repeat = document.getElementById('event-repeat');
    if (repeat && repeat.checked) newEvent.repeat = 'yearly';

    appData.events.push(newEvent);
    saveToFirebase(); closeModal("add-event-modal");
    document.getElementById("event-title").value = "";
    if (evtSel) evtSel.selectedIndex = -1;
};

function populateEmojiDropdowns() {
    const fill = (selectId, list) => {
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = list.map(e => `<option value="${e}">${e}</option>`).join("");
    };
    fill("edit-emoji-select", emojis);
    fill("edit-loc-emoji-select", locEmojis);
    fill("express-emoji-select", emojis);
    // also populate member edit selects if present
    const memEmoji = document.getElementById('edit-member-emoji');
    const memLoc = document.getElementById('edit-member-locemoji');
    if (memEmoji) memEmoji.innerHTML = emojis.map(e => `<option value="${e}">${e}</option>`).join('');
    if (memLoc) {
        const locs = locEmojis.slice();
        if (!locs.includes('\uD83D\uDC34')) locs.push('\uD83D\uDC34');
        memLoc.innerHTML = locs.map(e => `<option value="${e}">${e}</option>`).join('');
    }
}

// Globales Exportieren der Event-Handler für HTML onclick-Attribute
window.setRegMode = setRegMode;
window.submitRegistration = submitRegistration;
window.switchTab = switchTab;
window.saveVibe = saveVibe;
window.addRoom = addRoom;
window.addMoodRoom = addMoodRoom;
window.openExpressMood = openExpressMood;
window.saveExpressMood = saveExpressMood;
window.setTodoSegment = setTodoSegment;
window.addChore = addChore;
window.addTask = addTask;
window.addShoppingItem = addShoppingItem;
window.addCalendarEvent = addCalendarEvent;
window.openModal = openModal;
window.closeModal = closeModal;

    