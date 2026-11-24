# Daily push reminders

RoomMood sends one check-in notification per day at a random local time between 08:00 and 22:00. Push delivery while the app is closed uses Firebase Cloud Messaging and a scheduled Cloud Function.

## One-time Firebase setup

1. In Firebase Authentication, enable **Anonymous** sign-in.
2. In Firebase Cloud Messaging, create a Web Push certificate key pair.
3. In Firebase App Check, register the web app with the reCAPTCHA v3 provider and enable enforcement for Cloud Functions.
4. Add the generated public keys to the `<head>` of `index.html`:

   ```html
   <meta name="firebase-vapid-key" content="YOUR_PUBLIC_WEB_PUSH_KEY">
   <meta name="firebase-app-check-site-key" content="YOUR_RECAPTCHA_V3_SITE_KEY">
   ```

5. Upgrade the Firebase project to the Blaze plan and enable Cloud Scheduler when prompted. The reminder scheduler runs once per minute to deliver reminders close to their chosen time.
6. Merge this rule into the project's existing Firestore rules so push tokens cannot be read or changed by clients:

   ```text
   match /dailyReminderDevices/{deviceId} {
     allow read, write: if false;
   }
   ```

   Do not replace existing rules with this snippet; the app's home data uses Firestore too. Also remove or narrow any broader matching `allow` rule, since Firestore combines matching allows permissively.
7. From the project root, deploy the backend:

   ```powershell
   firebase deploy --only functions --project roommood-c198a
   ```

   Install the Firebase CLI first if it is not already available.

## Using reminders

Open RoomMood over HTTPS, allow browser notifications, and select **Erinnerung aktivieren** on the home screen. The permission and setup are per browser/device. On iOS, add the site to the Home Screen before enabling notifications. You can turn reminders off from the same card.

The scheduled function stores only the push token, time zone, and next delivery time in `dailyReminderDevices`. The Firestore rule above keeps that collection client-inaccessible. Notifications do not include RoomMood profile, location, or status data.
