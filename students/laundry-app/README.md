# Laundry App — Demo

A simplified, no-backend clone of Daniel's dormitory laundry scheduler from Lakefield. All Firebase calls (Firestore + Google Auth) have been replaced with an in-memory mock so the app runs locally with no setup, no API keys, and no real data.

## What's different from the original

- **No Firebase.** `firebase/app`, `firebase/auth`, and `firebase/firestore` are aliased to local mocks in `src/mock/` via `vite.config.js`.
- **No Google sign-in.** A demo user is pre-signed-in. Clicking "Sign in with Google" on the login page just re-signs in as the demo user.
- **Sample data.** Three dorms (Rashleigh, Grove, Colebrook) each get 3 washers + 3 dryers, with a few machines pre-populated in active / pending-pickup states so the UI shows real states.
- **All users are admin.** The `/admin` route is open to the demo user.
- **State resets on refresh.** Mutations live in module memory only — perfect for a demo.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Files

- `src/mock/firestore.js` — in-memory Firestore (collections, queries, listeners, batches, `Timestamp`).
- `src/mock/auth.js` — demo user + auth listener stubs.
- `src/mock/app.js` — `initializeApp` no-op.
- `src/mock/seedData.js` — sample machines, schedules, announcements.

To go back to a real Firebase backend, remove the `resolve.alias` block from `vite.config.js`, restore the `firebase` dependency in `package.json`, and put real values in a `.env` file.
