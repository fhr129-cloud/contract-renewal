import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc,
  getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import firebaseConfig from './firebase-config.js';
import { SEED_CONTRACTS } from './seed-data.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function listenContracts(callback) {
  const q = query(collection(db, 'contracts'), orderBy('endDate', 'asc'));
  return onSnapshot(q, snap => {
    const contracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(contracts);
  });
}

export async function addContract(data) {
  return addDoc(collection(db, 'contracts'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateContract(id, data) {
  return updateDoc(doc(db, 'contracts', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContract(id) {
  return deleteDoc(doc(db, 'contracts', id));
}

export async function addHistory(contractId, contractName, record) {
  const ref = doc(db, 'history', contractId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    return setDoc(ref, {
      contractId,
      name: contractName,
      records: [...existing.records, record],
      updatedAt: serverTimestamp(),
    });
  } else {
    return setDoc(ref, {
      contractId,
      name: contractName,
      records: [record],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export function listenHistory(callback) {
  return onSnapshot(collection(db, 'history'), snap => {
    const history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(history);
  });
}

export async function seedIfEmpty() {
  const snap = await getDocs(collection(db, 'contracts'));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  for (const c of SEED_CONTRACTS) {
    const ref = doc(collection(db, 'contracts'));
    batch.set(ref, { ...c, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  await batch.commit();
  console.log('시드 데이터 업로드 완료');
}
