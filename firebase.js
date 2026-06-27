import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

let app, db;

export function initFirebase() {
  if (firebaseConfig.apiKey === "VOTRE_API_KEY") {
    return false;
  }
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return true;
}

export function isFirebaseReady() {
  return !!db;
}

export const CATEGORIES = [
  { id: "musiques", label: "Musiques", emoji: "🎵" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "sportifs", label: "Sportifs", emoji: "🏅" },
  { id: "voyages", label: "Voyages", emoji: "✈️" },
  { id: "plats", label: "Plats", emoji: "🍽️" },
  { id: "films", label: "Films", emoji: "🎬" }
];

// --- Items ---

export async function getItems(categoryId) {
  const snap = await getDocs(collection(db, "categories", categoryId, "items"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function listenItems(categoryId, callback) {
  return onSnapshot(collection(db, "categories", categoryId, "items"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function saveItem(categoryId, item) {
  const id = item.id || `item-${Date.now()}`;
  await setDoc(doc(db, "categories", categoryId, "items", id), {
    title: item.title,
    imageUrl: item.imageUrl || ""
  });
  return id;
}

export async function deleteItem(categoryId, itemId) {
  await deleteDoc(doc(db, "categories", categoryId, "items", itemId));
}

// --- Game state ---

export async function getGameState() {
  const snap = await getDoc(doc(db, "game", "state"));
  return snap.exists() ? snap.data() : null;
}

export function listenGameState(callback) {
  return onSnapshot(doc(db, "game", "state"), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function setGameState(data) {
  await setDoc(doc(db, "game", "state"), data, { merge: true });
}

export async function startCategory(categoryId, bracketOrder) {
  await setGameState({
    activeCategory: categoryId,
    status: "playing",
    bracketOrder,
    startedAt: Date.now()
  });
}

export async function endCategory() {
  await setGameState({ status: "finished" });
}

// --- Players ---

export async function registerPlayer(name, isMathis, categoryId) {
  const id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, "players", id), {
    name,
    isMathis,
    categoryId,
    answers: {},
    joinedAt: Date.now()
  });
  localStorage.setItem("mathis18_playerId", id);
  return id;
}

export function getLocalPlayerId() {
  return localStorage.getItem("mathis18_playerId");
}

export async function getPlayer(playerId) {
  const snap = await getDoc(doc(db, "players", playerId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function listenPlayer(playerId, callback) {
  return onSnapshot(doc(db, "players", playerId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function saveAnswer(playerId, duelKey, choiceId) {
  const playerRef = doc(db, "players", playerId);
  const snap = await getDoc(playerRef);
  if (!snap.exists()) return;
  const answers = { ...snap.data().answers, [duelKey]: choiceId };
  await updateDoc(playerRef, { answers });
}

export async function getMathisPlayer(categoryId) {
  const q = query(
    collection(db, "players"),
    where("categoryId", "==", categoryId),
    where("isMathis", "==", true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export function listenPlayers(categoryId, callback) {
  const q = query(collection(db, "players"), where("categoryId", "==", categoryId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function clearPlayersForCategory(categoryId) {
  const q = query(collection(db, "players"), where("categoryId", "==", categoryId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
