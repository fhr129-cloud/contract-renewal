// db.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, onSnapshot,
  serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';
import { SEED_CONTRACTS } from './seed-data.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ── 계약 ──────────────────────────
export function listenContracts(cb) {
  var q = query(collection(db,'contracts'), orderBy('endDate','asc'));
  return onSnapshot(q, function(snap) {
    cb(snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); }));
  });
}

export function addContract(data) {
  return addDoc(collection(db,'contracts'), Object.assign({}, data, {
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
}

export function updateContract(id, data) {
  return updateDoc(doc(db,'contracts',id), Object.assign({}, data, {
    updatedAt: serverTimestamp()
  }));
}

export function deleteContract(id) {
  return deleteDoc(doc(db,'contracts',id));
}

// ── 계약 히스토리 ──────────────────────────
export async function addHistory(contractId, name, record) {
  var ref = doc(db,'history',contractId);
  var snap = await getDoc(ref);
  if (snap.exists()) {
    var ex = snap.data();
    return setDoc(ref, {
      contractId: contractId, name: name,
      records: ex.records.concat([record]),
      updatedAt: serverTimestamp()
    });
  }
  return setDoc(ref, {
    contractId: contractId, name: name,
    records: [record],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}

export function listenHistory(cb) {
  return onSnapshot(collection(db,'history'), function(snap) {
    cb(snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); }));
  });
}

// ── 운영지원 ──────────────────────────
export function addSupport(data) {
  return addDoc(collection(db,'supports'), Object.assign({}, data, {
    createdAt: serverTimestamp()
  }));
}

export function listenSupports(cb) {
  return onSnapshot(collection(db,'supports'), function(snap) {
    cb(snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); }));
  });
}

export function deleteSupport(id) {
  return deleteDoc(doc(db,'supports',id));
}

// ── 시드 ──────────────────────────
export async function seedIfEmpty() {
  var snap = await getDocs(collection(db,'contracts'));
  if (!snap.empty) return;
  var batch = writeBatch(db);
  SEED_CONTRACTS.forEach(function(c) {
    var ref = doc(collection(db,'contracts'));
    batch.set(ref, Object.assign({}, c, {
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });
  await batch.commit();
}
