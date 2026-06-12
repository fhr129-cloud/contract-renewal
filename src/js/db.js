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

export async function seedIfEmpty() {
  const snap = await getDocs(collection(db,'contracts'));
  if(snap.empty) {
    const { SEED_DATA } = await import('./seed-data.js');
    for(const c of SEED_DATA) {
      await addDoc(collection(db,'contracts'), c);
    }
  }
  // 히스토리 항상 최신 데이터로 갱신
  await seedHistory();
}

async function seedHistory() {
  const { SEED_HISTORY } = await import('./seed-data.js');
  const contractSnap = await getDocs(collection(db,'contracts'));
  const contractMap = {};
  contractSnap.docs.forEach(d => { contractMap[d.data().name] = d.id; });

  for(const h of SEED_HISTORY) {
    const contractId = contractMap[h.name];
    if(!contractId) continue;
    await setDoc(doc(db,'history',contractId), {
      contractId,
      name: h.name,
      records: h.records,
      updatedAt: serverTimestamp()
    });
  }
}

  // 계약 데이터 업로드
  var batch = writeBatch(db);
  var contractIds = {};
  SEED_CONTRACTS.forEach(function(c) {
    var ref = doc(collection(db,'contracts'));
    contractIds[c.name] = ref.id;
    batch.set(ref, Object.assign({}, c, {
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });
  await batch.commit();

  // 히스토리 업로드
  await seedHistory(contractIds);
}

async function seedHistory(contractIds) {
  // contractIds 없으면 Firebase에서 직접 조회
  if (!contractIds) {
    var snap = await getDocs(collection(db,'contracts'));
    contractIds = {};
    snap.docs.forEach(function(d) {
      contractIds[d.data().name] = d.id;
    });
  }

  var batch = writeBatch(db);
  SEED_HISTORY.forEach(function(h) {
    var cid = contractIds[h.name];
    if (!cid) return;
    var ref = doc(db,'history', cid);
    batch.set(ref, {
      contractId: cid,
      name: h.name,
      records: h.records,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}
