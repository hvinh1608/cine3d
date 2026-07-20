# Android / Play Store release checklist

This repository is release-validatable, not credential-complete. Do not call a
build Play-Store-ready until every external item below is completed.

## Build and signing

- Confirm package `vn.cine3d.app`, marketing version, remote EAS build number,
  and Play Console application match.
- Keep all keystores, service-account JSON, `google-services.json`, `.env.local`
  files, passwords, and EAS tokens out of Git. EAS profiles use remote
  credentials.
- Configure named EAS environments (`development`, `preview`, `production`)
  with the appropriate `EXPO_PUBLIC_*` values.
- Development APK:
  `npx eas-cli build --platform android --profile development`
- Internal preview APK:
  `npx eas-cli build --platform android --profile preview`
- Production AAB:
  `npx eas-cli build --platform android --profile production`
- Local debug APK after prebuild:
  Windows: `cd android && gradlew.bat assembleDebug`
  macOS/Linux: `cd android && ./gradlew assembleDebug`
- Local release bundle (requires an intentionally configured, untracked
  signing setup):
  Windows: `cd android && gradlew.bat bundleRelease`
  macOS/Linux: `cd android && ./gradlew bundleRelease`
- Expected local artifacts:
  `android/app/build/outputs/apk/debug/app-debug.apk` and
  `android/app/build/outputs/bundle/release/app-release.aab`.

## Firebase, OAuth, and Play Billing

1. Download the Android Firebase config for `vn.cine3d.app` and place it at
   `mobile/google-services.json` locally. Never commit it. For EAS, create a
   secret file environment variable named `GOOGLE_SERVICES_FILE`; the dynamic
   Expo config includes the file only when it exists. The checked-in
   `google-services.json.example` is structural documentation, not a usable
   Firebase credential.
2. Upload FCM V1 credentials to EAS/Expo and provide
   `FIREBASE_SERVICE_ACCOUNT_JSON` only to the backend secret store.
3. Configure the Google OAuth Android client for package `vn.cine3d.app` with
   debug, EAS, and Play App Signing SHA-1 values. Put the Web OAuth client ID in
   `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and the backend Google audience list.
4. Create Play subscriptions/base plans matching
   `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_IDS`; activate them and map each product to
   an active backend VIP plan with `PLAY_PRODUCT_PLAN_MAP`.
5. Grant the backend service account the least Play Console permissions needed
   for subscription verification and acknowledgement. Store
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` as a backend secret.
6. Configure Pub/Sub RTDN for subscriptions. Route notifications through a
   trusted relay that adds the configured `GOOGLE_PLAY_RTDN_SECRET` header;
   never put this secret in the app.
7. Test purchase, renewal, grace period, account hold, cancellation, expiry,
   restore/reinstall, duplicate token ownership, and acknowledgement using a
   licensed tester and an internal-track install.

## App Links and signing SHA

After Play App Signing is enabled, copy the **App signing key certificate**
SHA-256 fingerprint (not merely the upload key) into the hosted
`assetlinks.json` template. Host it at:

`https://cine3d.id.vn/.well-known/assetlinks.json`

Serve HTTP 200, `Content-Type: application/json`, no authentication, and no
redirect chain. Verify with Android `pm get-app-links vn.cine3d.app` and
`adb shell am start -W -a android.intent.action.VIEW -d
"https://cine3d.id.vn/movies/<real-slug>" vn.cine3d.app`.

## Privacy, data safety, and permissions

- Declare account/profile data, email, user-generated comments/chat/feedback,
  purchase/subscription data, device identifiers/push token, diagnostics,
  coarse IP/session metadata, watch/search/history/preferences, and uploaded
  avatar handling exactly as deployed.
- Disclose purposes (account, personalization, app functionality, fraud/security,
  analytics, developer communications), encryption in transit, retention, and
  deletion behavior. Do not mark data “not collected” merely because it is
  server-processed.
- The app requests notifications and biometric capability. It blocks location,
  camera, and microphone. Image selection uses the system picker.
- Publish stable HTTPS privacy-policy and terms URLs. Keep native legal copy in
  sync.
- Play requires a public account-deletion URL and an in-app deletion path for
  apps that create accounts. Both exist: `https://cine3d.id.vn/data-deletion`
  and authenticated `DELETE /user/account` from Account → Legal → Data deletion.
  Document retention exceptions for billing/fraud records in the Play Data Safety
  form.

## Content, rating, and rights

- Complete the IARC questionnaire for streaming movies, user comments/chat,
  online interaction, and any mature/violent/sexual/drug/language content.
- Supply documented licenses/permissions for every catalog item, poster,
  subtitle, trailer, and stream. The app must not facilitate unauthorized
  downloading.
- State that downloads are limited to server-authorized MP4 sources for
  offline playback. Confirm rights permit offline copies and define expiry/
  removal behavior. Do not describe unsupported HLS/DRM downloads.
- Document moderation/reporting, abuse response, blocked-user policy if added,
  and child-directed/kids-profile limitations. A kids profile alone does not
  make the service COPPA-compliant.

## Listing and assets

Suggested short description:

`Xem phim trực tuyến, theo dõi tập mới và xem chung cùng bạn bè.`

Suggested full-description points: native discovery, personal library and
profiles, synchronized watch rooms, accessible player controls, optional
notifications, VIP subscriptions on Google Play, and authorized offline
viewing. Avoid claims such as “all movies,” “free forever,” “4K,” or “ad-free”
unless verified.

Provide a 512×512 Play icon, 1024×500 feature graphic, phone screenshots (home,
search, detail, player controls, library, watch room), and tablet screenshots
if tablet support remains enabled. Screenshots must use licensed content,
production-like data, no personal data, and no debug overlays.

## Testing and rollout

1. Run repository validation and dependency review; use `npm audit` for triage,
   never `npm audit --force`. Record accepted advisories with package,
   exploitability, compensating control, owner, and review date.
2. Run Maestro with an installed development/preview APK:
   `maestro test -e SEARCH_QUERY="matrix" -e MOVIE_SLUG="<real-slug>" maestro`
3. Test Android 8 through current target API, low-memory devices, phones/tablets,
   rotation/fullscreen/PiP, offline/reconnect, denied notifications, expired
   sessions, deep links, push taps, and all billing states.
4. Use internal testing first, then closed testing. Meet Play’s tester/duration
   requirements for the account type before production access.
5. Review pre-launch reports, accessibility, crashes/ANRs, source playback,
   privacy forms, content rating, target audience, app access instructions,
   and release notes.
6. Roll out in stages with backend version policy configured but not forced
   until the new version is demonstrably available to users.
