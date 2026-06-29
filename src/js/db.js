import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, onSnapshot,
  serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';
import { SEED_CONTRACTS, SEED_HISTORY } from './seed-data.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

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

export async function addHistory(contractId, name, record) {
  var ref = doc(db,'history',contractId);
  var snap = await getDoc(ref);
  if(snap.exists()) {
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

export function updateSupport(id, data) {
  return updateDoc(doc(db,'supports',id), Object.assign({}, data, {
    updatedAt: serverTimestamp()
  }));
}

export function updateSupportBizName(id, bizName) {
  return updateDoc(doc(db,'supports',id), { bizName: bizName, updatedAt: serverTimestamp() });
}
export async function seedIfEmpty() {
  const snap = await getDocs(collection(db,'contracts'));
  if(snap.empty) {
    const SEED_DATA = SEED_CONTRACTS;
    const batch = writeBatch(db);
    SEED_DATA.forEach(function(c) {
      const ref = doc(collection(db,'contracts'));
      batch.set(ref, Object.assign({}, c, {
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }));
    });
    await batch.commit();
  }
  await seedHistory();
}

export function updateHistoryName(contractId, name) {
  return updateDoc(doc(db,'history',contractId), { name: name, updatedAt: serverTimestamp() });
}

export function saveHistoryRecords(contractId, name, records) {
  return setDoc(doc(db,'history',contractId), {
    contractId: contractId,
    name: name||'',
    records: records,
    updatedAt: serverTimestamp()
  });
}

async function seedHistory() {
  // 이미 히스토리가 있으면 스킵
  const histSnap = await getDocs(collection(db,'history'));
  if(histSnap.size > 0) return;
  const contractSnap = await getDocs(collection(db,'contracts'));
  const contractMap = {};
  contractSnap.docs.forEach(function(d) {
    contractMap[d.data().name] = d.id;
  });
  const batch = writeBatch(db);
  SEED_HISTORY.forEach(function(h) {
    const contractId = contractMap[h.name];
    if(!contractId) return;
    const ref = doc(db,'history',contractId);
    batch.set(ref, {
      contractId: contractId,
      name: h.name,
      records: h.records,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}
