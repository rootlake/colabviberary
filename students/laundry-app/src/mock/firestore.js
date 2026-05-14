// In-memory mock of the firebase/firestore surface used by this app.
// Everything lives in module-level state — refresh resets to seed data.

import { seedData } from './seedData';

// store: { [collectionName]: Map<id, data> }
const store = {};

// listeners: array of { collection, predicate, callback }
const listeners = [];

let docCounter = 0;
const nextId = () => `mock_${Date.now().toString(36)}_${(docCounter++).toString(36)}`;

function ensureCollection(name) {
  if (!store[name]) store[name] = new Map();
  return store[name];
}

function seedStore() {
  for (const [name, docs] of Object.entries(seedData())) {
    const map = ensureCollection(name);
    for (const { id, ...rest } of docs) {
      map.set(id, rest);
    }
  }
}
seedStore();

function notify(collectionName) {
  for (const l of listeners) {
    if (l.collection === collectionName) {
      try { l.fire(); } catch (e) { /* swallow */ }
    }
  }
}

// ---------- Timestamp ----------
export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    return Timestamp.fromMillis(Date.now());
  }
  static fromDate(date) {
    return Timestamp.fromMillis(date.getTime());
  }
  static fromMillis(ms) {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  toDate() {
    return new Date(this.toMillis());
  }
  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
}

export const serverTimestamp = () => Timestamp.now();

// ---------- Refs ----------
class CollectionRef {
  constructor(name) {
    this.__type = 'collection';
    this.name = name;
  }
}

class DocRef {
  constructor(collectionName, id) {
    this.__type = 'doc';
    this.collectionName = collectionName;
    this.id = id;
  }
}

class QueryRef {
  constructor(collectionName, constraints) {
    this.__type = 'query';
    this.collectionName = collectionName;
    this.constraints = constraints;
  }
}

class Constraint {
  constructor(kind, payload) {
    this.kind = kind;
    this.payload = payload;
  }
}

// ---------- Snapshot helpers ----------
function makeDocSnapshot(collectionName, id, data) {
  return {
    id,
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
    ref: new DocRef(collectionName, id)
  };
}

function applyConstraints(docs, constraints) {
  let out = docs.slice();
  const wheres = constraints.filter(c => c.kind === 'where');
  for (const w of wheres) {
    const { field, op, value } = w.payload;
    out = out.filter(({ data }) => {
      const v = data?.[field];
      switch (op) {
        case '==': return v === value;
        case '!=': return v !== value;
        case '<': return v < value;
        case '<=': return v <= value;
        case '>': return v > value;
        case '>=': return v >= value;
        case 'in': return Array.isArray(value) && value.includes(v);
        case 'not-in': return Array.isArray(value) && !value.includes(v);
        case 'array-contains': return Array.isArray(v) && v.includes(value);
        default: return true;
      }
    });
  }
  const orders = constraints.filter(c => c.kind === 'orderBy');
  for (const o of orders) {
    const { field, direction } = o.payload;
    const dir = direction === 'desc' ? -1 : 1;
    out.sort((a, b) => {
      const av = a.data?.[field];
      const bv = b.data?.[field];
      const am = av?.toMillis ? av.toMillis() : av;
      const bm = bv?.toMillis ? bv.toMillis() : bv;
      if (am === bm) return 0;
      if (am == null) return 1;
      if (bm == null) return -1;
      return am < bm ? -1 * dir : 1 * dir;
    });
  }
  return out;
}

function readDocs(collectionName, constraints = []) {
  const map = ensureCollection(collectionName);
  const docs = [...map.entries()].map(([id, data]) => ({ id, data }));
  return applyConstraints(docs, constraints);
}

function makeQuerySnapshot(collectionName, results) {
  const docs = results.map(({ id, data }) => makeDocSnapshot(collectionName, id, data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach(cb)
  };
}

// ---------- Public API ----------
export function getFirestore() {
  return { __mock: true };
}

export function collection(_db, name) {
  return new CollectionRef(name);
}

export function doc(_db, collectionOrName, idMaybe) {
  // doc(db, 'name', id) or doc(collectionRef, id) — we only see the first form.
  if (collectionOrName instanceof CollectionRef) {
    return new DocRef(collectionOrName.name, idMaybe || nextId());
  }
  return new DocRef(collectionOrName, idMaybe || nextId());
}

export function query(ref, ...constraints) {
  const name = ref instanceof CollectionRef ? ref.name : ref.collectionName;
  const existing = ref instanceof QueryRef ? ref.constraints : [];
  return new QueryRef(name, [...existing, ...constraints]);
}

export function where(field, op, value) {
  return new Constraint('where', { field, op, value });
}

export function orderBy(field, direction = 'asc') {
  return new Constraint('orderBy', { field, direction });
}

export function limit(n) {
  return new Constraint('limit', { n });
}

function refToReader(ref) {
  if (ref instanceof CollectionRef) {
    return { collection: ref.name, constraints: [] };
  }
  if (ref instanceof QueryRef) {
    return { collection: ref.collectionName, constraints: ref.constraints };
  }
  throw new Error('Unsupported ref type');
}

export function onSnapshot(refOrQuery, callback) {
  const { collection: name, constraints } = refToReader(refOrQuery);
  const fire = () => {
    const results = readDocs(name, constraints);
    callback(makeQuerySnapshot(name, results));
  };
  const listener = { collection: name, fire };
  listeners.push(listener);
  // Fire async to match Firestore's initial-snapshot behavior.
  Promise.resolve().then(fire);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function getDocs(refOrQuery) {
  const { collection: name, constraints } = refToReader(refOrQuery);
  return makeQuerySnapshot(name, readDocs(name, constraints));
}

export async function getDoc(docRef) {
  const map = ensureCollection(docRef.collectionName);
  const data = map.get(docRef.id);
  return makeDocSnapshot(docRef.collectionName, docRef.id, data);
}

export async function addDoc(collectionRef, data) {
  const name = collectionRef.name;
  const id = nextId();
  ensureCollection(name).set(id, { ...data });
  notify(name);
  return new DocRef(name, id);
}

export async function setDoc(docRef, data) {
  ensureCollection(docRef.collectionName).set(docRef.id, { ...data });
  notify(docRef.collectionName);
}

export async function updateDoc(docRef, updates) {
  const map = ensureCollection(docRef.collectionName);
  const existing = map.get(docRef.id);
  if (!existing) {
    throw new Error(`No document at ${docRef.collectionName}/${docRef.id}`);
  }
  map.set(docRef.id, { ...existing, ...updates });
  notify(docRef.collectionName);
}

export async function deleteDoc(docRef) {
  const map = ensureCollection(docRef.collectionName);
  map.delete(docRef.id);
  notify(docRef.collectionName);
}

export function writeBatch() {
  const ops = [];
  const touched = new Set();
  return {
    set(docRef, data) {
      ops.push(() => {
        ensureCollection(docRef.collectionName).set(docRef.id, { ...data });
        touched.add(docRef.collectionName);
      });
      return this;
    },
    update(docRef, updates) {
      ops.push(() => {
        const map = ensureCollection(docRef.collectionName);
        const existing = map.get(docRef.id);
        if (existing) map.set(docRef.id, { ...existing, ...updates });
        touched.add(docRef.collectionName);
      });
      return this;
    },
    delete(docRef) {
      ops.push(() => {
        ensureCollection(docRef.collectionName).delete(docRef.id);
        touched.add(docRef.collectionName);
      });
      return this;
    },
    async commit() {
      for (const op of ops) op();
      for (const name of touched) notify(name);
    }
  };
}
