import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, onSnapshot,
  serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import firebaseConfig from './firebase-config.js';
import { SEED_CONTRACTS, SEED_HISTORY } from './seed-data.js';
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ── 인증 ──────────────────────────
function phoneToEmail(phone){ return phone.replace(/[^0-9]/g,'')+'@onjeong.app'; }
export async function checkAllowedUser(phone){
  var p=phone.replace(/[^0-9]/g,'');
  var snap=await getDoc(doc(db,'allowedUsers',p));
  return snap.exists()?snap.data():null;
}
export async function loginUser(phone,password){
  await setPersistence(auth,browserLocalPersistence);
  return signInWithEmailAndPassword(auth,phoneToEmail(phone),password);
}
export async function registerUser(phone,password){
  await setPersistence(auth,browserLocalPersistence);
  var cred=await createUserWithEmailAndPassword(auth,phoneToEmail(phone),password);
  var p=phone.replace(/[^0-9]/g,'');
  try{ await updateDoc(doc(db,'allowedUsers',p),{registered:true}); }catch(e){}
  return cred;
}
export function watchAuth(callback){ return onAuthStateChanged(auth,callback); }
export function logoutUser(){ return signOut(auth); }

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
export async function fetchAllForBackup(){
  var result={};
  var cols=['contracts','history','supports','allowedUsers'];
  for(var i=0;i<cols.length;i++){
    var snap=await getDocs(collection(db,cols[i]));
    result[cols[i]]=snap.docs.map(function(d){ return {_id:d.id,data:d.data()}; });
  }
  return result;
}
