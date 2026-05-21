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

export
