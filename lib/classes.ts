"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export type TeacherClass = {
  id: string;
  name: string;
  section: string;
  teacherId: string;
  teacherName: string;
  behaviorTitle?: string;
  behaviorInstructions?: string;
  refusalStyle?: string;
  createdAt?: unknown;
};

export type ClassStudent = {
  id: string;
  email: string;
  displayName: string;
  addedAt?: unknown;
};

export type ClassMaterial = {
  id: string;
  title: string;
  kind: string;
  fileName?: string;
  chunkCount?: number;
  status: "uploaded" | "processing" | "ready";
  addedAt?: unknown;
};

export function subscribeToTeacherClasses(
  teacherId: string,
  callback: (classes: TeacherClass[]) => void
) {
  assertFirestoreReady();

  const classesQuery = query(collection(db!, "classes"), where("teacherId", "==", teacherId));

  return onSnapshot(classesQuery, (snapshot) => {
    const classes = snapshot.docs
      .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }) as TeacherClass)
      .sort((firstClass, secondClass) => firstClass.name.localeCompare(secondClass.name));

    callback(classes);
  });
}

export function subscribeToClassStudents(
  classId: string,
  callback: (students: ClassStudent[]) => void
) {
  assertFirestoreReady();

  return onSnapshot(collection(db!, "classes", classId, "students"), (snapshot) => {
    const students = snapshot.docs
      .map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }) as ClassStudent)
      .sort((firstStudent, secondStudent) => firstStudent.email.localeCompare(secondStudent.email));

    callback(students);
  });
}

export function subscribeToClassMaterials(
  classId: string,
  callback: (materials: ClassMaterial[]) => void
) {
  assertFirestoreReady();

  return onSnapshot(collection(db!, "classes", classId, "materials"), (snapshot) => {
    const materials = snapshot.docs
      .map((materialDoc) => ({ id: materialDoc.id, ...materialDoc.data() }) as ClassMaterial)
      .sort((firstMaterial, secondMaterial) => firstMaterial.title.localeCompare(secondMaterial.title));

    callback(materials);
  });
}

export async function createTeacherClass({
  name,
  section,
  teacherId,
  teacherName
}: {
  name: string;
  section: string;
  teacherId: string;
  teacherName: string;
}) {
  assertFirestoreReady();

  return addDoc(collection(db!, "classes"), {
    name: name.trim(),
    section: section.trim(),
    teacherId,
    teacherName,
    behaviorTitle: "Guided problem solving",
    behaviorInstructions: [
      "Ask students to explain their thinking before giving hints.",
      "Do not provide final answers unless the student has already shown the main reasoning.",
      "Use course materials before generic explanations when relevant."
    ].join("\n"),
    refusalStyle:
      "If a student asks for a direct answer, redirect them toward the next useful step and ask a checking question.",
    createdAt: serverTimestamp()
  });
}

export async function updateTeacherClassSettings({
  behaviorInstructions,
  behaviorTitle,
  classId,
  name,
  refusalStyle,
  section
}: {
  behaviorInstructions: string;
  behaviorTitle: string;
  classId: string;
  name: string;
  refusalStyle: string;
  section: string;
}) {
  assertFirestoreReady();

  await updateDoc(doc(db!, "classes", classId), {
    behaviorInstructions: behaviorInstructions.trim(),
    behaviorTitle: behaviorTitle.trim(),
    name: name.trim(),
    refusalStyle: refusalStyle.trim(),
    section: section.trim()
  });
}

export async function addStudentToClass({
  classId,
  displayName,
  email
}: {
  classId: string;
  displayName: string;
  email: string;
}) {
  assertFirestoreReady();

  const normalizedEmail = email.trim().toLowerCase();
  const studentId = encodeURIComponent(normalizedEmail);

  await setDoc(doc(db!, "classes", classId, "students", studentId), {
    email: normalizedEmail,
    displayName: displayName.trim(),
    addedAt: serverTimestamp()
  });
}

export async function addClassMaterial({
  classId,
  fileName,
  kind,
  text,
  title
}: {
  classId: string;
  fileName?: string;
  kind: string;
  text: string;
  title: string;
}) {
  assertFirestoreReady();

  const chunks = chunkText(text);
  const materialRef = await addDoc(collection(db!, "classes", classId, "materials"), {
    title: title.trim(),
    kind,
    fileName: fileName?.trim() || "",
    chunkCount: chunks.length,
    status: chunks.length ? "ready" : "uploaded",
    addedAt: serverTimestamp()
  });

  const batch = writeBatch(db!);

  chunks.forEach((chunk, index) => {
    const chunkRef = doc(collection(db!, "classes", classId, "materials", materialRef.id, "chunks"));
    batch.set(chunkRef, {
      content: chunk,
      label: `Chunk ${index + 1}`,
      order: index
    });
  });

  await batch.commit();
}

function chunkText(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [];
  }

  const chunks: string[] = [];
  const chunkSize = 1200;
  const overlap = 160;

  for (let start = 0; start < normalizedText.length; start += chunkSize - overlap) {
    chunks.push(normalizedText.slice(start, start + chunkSize));
  }

  return chunks;
}

function assertFirestoreReady() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }
}
