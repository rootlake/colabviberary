// In-memory mock of the firebase/auth surface used by this app.
// A demo user is signed in by default so the app is immediately usable.

const DEMO_USER = {
  uid: 'demo-user-001',
  email: 'demo@example.edu',
  displayName: 'Demo Student',
  photoURL: null,
  emailVerified: true
};

const authState = {
  currentUser: { ...DEMO_USER }
};

const listeners = new Set();

function notify() {
  for (const cb of listeners) {
    try { cb(authState.currentUser); } catch (_) { /* ignore */ }
  }
}

export function getAuth() {
  // Return a proxy so reads of `auth.currentUser` always see the latest user.
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'currentUser') return authState.currentUser;
      return undefined;
    }
  });
}

export function onAuthStateChanged(_auth, cb) {
  listeners.add(cb);
  Promise.resolve().then(() => cb(authState.currentUser));
  return () => listeners.delete(cb);
}

export async function signInWithPopup(_auth, _provider) {
  authState.currentUser = { ...DEMO_USER };
  notify();
  return { user: authState.currentUser };
}

export async function signOut(_auth) {
  authState.currentUser = null;
  notify();
}

export async function updateProfile(_user, { displayName, photoURL }) {
  if (!authState.currentUser) return;
  if (displayName !== undefined) authState.currentUser.displayName = displayName;
  if (photoURL !== undefined) authState.currentUser.photoURL = photoURL;
  // Re-emit so listeners refresh.
  notify();
}

export class GoogleAuthProvider {
  setCustomParameters() { /* no-op */ }
}

export const DEMO_USER_ID = DEMO_USER.uid;
