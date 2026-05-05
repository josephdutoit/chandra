"use client";

import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";

export type AccountRole = "student" | "teacher";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: AccountRole;
  createdAt?: unknown;
};

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export function subscribeToUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
) {
  if (!db) {
    callback(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, "users", uid),
    (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function signUpWithRole({
  displayName,
  email,
  password,
  role
}: {
  displayName: string;
  email: string;
  password: string;
  role: AccountRole;
}) {
  assertFirebaseReady();

  const credential = await createUserWithEmailAndPassword(auth!, email, password);
  await updateProfile(credential.user, { displayName });

  const profile: UserProfile = {
    uid: credential.user.uid,
    email,
    displayName,
    role,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db!, "users", credential.user.uid), profile);
  return profile;
}

export async function createRoleProfile({
  displayName,
  role,
  user
}: {
  displayName: string;
  role: AccountRole;
  user: User;
}) {
  assertFirebaseReady();

  const cleanDisplayName = displayName.trim() || user.displayName || user.email || "Chandra user";
  await updateProfile(user, { displayName: cleanDisplayName });

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: cleanDisplayName,
    role,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db!, "users", user.uid), profile);
  return profile;
}

export async function signInWithEmail(email: string, password: string) {
  assertFirebaseReady();
  return signInWithEmailAndPassword(auth!, email, password);
}

export async function signOutCurrentUser() {
  assertFirebaseReady();
  return signOut(auth!);
}

export async function getUserProfile(uid: string) {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

function assertFirebaseReady() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }
}
