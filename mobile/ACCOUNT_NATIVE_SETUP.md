# Native account and VIP setup

The account UI never reports OAuth, push, deletion, or billing success unless the provider/server confirms it.

## Development build

OAuth, device push tokens, biometrics, image picking, and Google Play Billing require an Expo development or production build (not Expo Go):

```sh
npx expo prebuild --clean
eas build --profile development --platform android
```

## Environment and provider configuration

- `EXPO_PUBLIC_API_URL`: API root ending in `/api`.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`: Web OAuth client ID used to request the Google ID token. Add this same ID to backend `GOOGLE_CLIENT_IDS`.
- Create a separate Android OAuth client with package `vn.cine3d.app` and every signing SHA-1 used for debug, EAS, and Play App Signing. Sideload APKs are signed with `android/app/debug.keystore` — SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Also register any other keystores you use (e.g. `~/.android/debug.keystore`).
- Google login uses the native Android account picker through `@react-native-google-signin/google-signin`; it does not use a browser redirect. Facebook login is not exposed in the Android app.
- `EXPO_PUBLIC_APP_ATTESTATION_TOKEN`: must match backend `MOBILE_APP_ATTESTATION_TOKEN`. This current static contract is extractable from an app bundle and must be replaced by Play Integrity/App Attest before it is treated as a security boundary.

### Render / production login

Mobile login/register **cannot** complete Cloudflare Turnstile. Production must run a backend build that accepts native clients via attestation:

1. Set Render env `MOBILE_APP_ATTESTATION_TOKEN` to the same value as `EXPO_PUBLIC_APP_ATTESTATION_TOKEN` in `mobile/.env.local`.
2. Deploy the backend that includes `evaluateNativeAuthGate` (native `X-Client-Type: mobile` + matching `X-App-Attestation` skips Turnstile).
3. Until that secret is set, the new backend allows native auth in an open migration mode and logs a warning — still prefer setting the shared secret.

If the app shows “Cloudflare/Turnstile”, the phone is talking to an API that has not received this deploy yet.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: enables push permission/registration UI. Add valid `google-services.json` / `GoogleService-Info.plist` to the native build and configure FCM credentials.
- `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_IDS`: comma-separated subscription IDs from Play Console.

Password reset mail must target `cine3d://account/auth?resetToken=<token>` via backend `PASSWORD_RESET_URL`. Native email verification links must route to `cine3d://account/auth?verificationToken=<token>` and use the JSON `POST /auth/verify-email` contract.

## VIP purchases

Android does **not** sell VIP inside the app. The VIP screen opens
`https://cine3d.id.vn/vip` so users pay on the website with the same account,
then return to the app and refresh VIP status.

Google Play Billing code remains in the repo for a future Play Store release,
but the current product flow is website-only.

## Current server limitations

- Account deletion uses `DELETE /user/account` with confirmation
  `DELETE_MY_ACCOUNT`. Email/password accounts must also send the current password.
  Social-only accounts delete with confirmation alone while authenticated.
  Admin accounts are rejected. The public web URL
  `https://cine3d.id.vn/data-deletion` remains for users without app access.
- Push preferences currently expose one server-side device toggle; category-specific toggles require additional backend contracts.
- iOS StoreKit verification is not implemented by the backend, so purchasing is truthfully disabled outside Android Google Play.
