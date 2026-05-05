"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api-client";
import {
  addClassMaterial,
  addStudentToClass,
  createTeacherClass,
  subscribeToClassMaterials,
  subscribeToClassStudents,
  subscribeToTeacherClasses,
  updateTeacherClassSettings,
  type ClassMaterial,
  type ClassStudent,
  type TeacherClass
} from "@/lib/classes";
import { useAuth } from "./AuthProvider";

export function TeacherClassManager() {
  const { profile, user } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [className, setClassName] = useState("");
  const [classSection, setClassSection] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [activeTab, setActiveTab] = useState<"roster" | "settings" | "materials">("roster");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialKind, setMaterialKind] = useState("lecture-notes");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialText, setMaterialText] = useState("");
  const [error, setError] = useState("");
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);

  useEffect(() => {
    if (!user) {
      return () => {};
    }

    return subscribeToTeacherClasses(user.uid, setClasses);
  }, [user]);

  const activeClassId = useMemo(() => {
    if (classes.some((teacherClass) => teacherClass.id === selectedClassId)) {
      return selectedClassId;
    }

    return classes[0]?.id ?? "";
  }, [classes, selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((teacherClass) => teacherClass.id === activeClassId) ?? null,
    [activeClassId, classes]
  );

  useEffect(() => {
    if (!activeClassId) {
      return () => {};
    }

    const unsubscribeStudents = subscribeToClassStudents(activeClassId, setStudents);
    const unsubscribeMaterials = subscribeToClassMaterials(activeClassId, setMaterials);

    return () => {
      unsubscribeStudents();
      unsubscribeMaterials();
    };
  }, [activeClassId]);

  async function submitClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !profile) {
      return;
    }

    setError("");
    setIsSavingClass(true);

    try {
      const createdClass = await createTeacherClass({
        name: className,
        section: classSection,
        teacherId: user.uid,
        teacherName: profile.displayName
      });

      setSelectedClassId(createdClass.id);
      setClassName("");
      setClassSection("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Class creation failed.");
    } finally {
      setIsSavingClass(false);
    }
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeClassId) {
      return;
    }

    setError("");
    setIsSavingSettings(true);
    const formData = new FormData(event.currentTarget);

    try {
      await updateTeacherClassSettings({
        behaviorInstructions: String(formData.get("behaviorInstructions") ?? ""),
        behaviorTitle: String(formData.get("behaviorTitle") ?? ""),
        classId: activeClassId,
        name: String(formData.get("name") ?? ""),
        refusalStyle: String(formData.get("refusalStyle") ?? ""),
        section: String(formData.get("section") ?? "")
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Class settings failed.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeClassId) {
      return;
    }

    setError("");
    setIsSavingStudent(true);

    try {
      await addStudentToClass({
        classId: activeClassId,
        displayName: studentName,
        email: studentEmail
      });

      setStudentEmail("");
      setStudentName("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Student add failed.");
    } finally {
      setIsSavingStudent(false);
    }
  }

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeClassId) {
      return;
    }

    setError("");
    setIsSavingMaterial(true);

    try {
      const uploadedText = materialFile ? await extractMaterialText(materialFile) : "";
      const searchableText = [uploadedText, materialText].filter(Boolean).join("\n\n");

      if (!searchableText.trim()) {
        throw new Error("Add a text-based file or paste material text before uploading.");
      }

      await addClassMaterial({
        classId: activeClassId,
        fileName: materialFile?.name,
        kind: materialKind,
        text: searchableText,
        title: materialTitle
      });

      setMaterialTitle("");
      setMaterialFile(null);
      setMaterialText("");
      setMaterialKind("lecture-notes");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Material upload failed.");
    } finally {
      setIsSavingMaterial(false);
    }
  }

  return (
    <section className="class-workflow" aria-label="Class workflow">
      <article className="panel class-list-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Classes</p>
            <h2>Your classes</h2>
          </div>
          <span className="status ok">{classes.length} total</span>
        </div>

        <form className="class-form" onSubmit={submitClass}>
          <label className="field-label" htmlFor="class-name">
            Class name
          </label>
          <input
            id="class-name"
            required
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="Algebra 2"
          />

          <label className="field-label" htmlFor="class-section">
            Section
          </label>
          <input
            id="class-section"
            required
            value={classSection}
            onChange={(event) => setClassSection(event.target.value)}
            placeholder="Period 3"
          />

          <button className="primary-button" disabled={isSavingClass} type="submit">
            {isSavingClass ? "Creating" : "Create class"}
          </button>
        </form>

        <div className="class-list">
          {classes.map((teacherClass) => (
            <button
              aria-pressed={teacherClass.id === activeClassId}
              className="class-row"
              key={teacherClass.id}
              type="button"
              onClick={() => setSelectedClassId(teacherClass.id)}
            >
              <strong>{teacherClass.name}</strong>
              <span>{teacherClass.section}</span>
            </button>
          ))}

          {!classes.length ? (
            <div className="empty-state">
              <strong>No classes yet</strong>
              <span>Create a class to add students, policies, and materials.</span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="panel class-detail-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Class workspace</p>
            <h2>{selectedClass ? selectedClass.name : "Create a class"}</h2>
          </div>
          {selectedClass ? (
            <Link className="secondary-button compact" href={`/student?classId=${selectedClass.id}&preview=teacher`}>
              Student view
            </Link>
          ) : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {selectedClass ? (
          <>
            <div className="tab-list" role="tablist" aria-label="Class editor sections">
              <button
                aria-selected={activeTab === "roster"}
                role="tab"
                type="button"
                onClick={() => setActiveTab("roster")}
              >
                Roster
              </button>
              <button
                aria-selected={activeTab === "settings"}
                role="tab"
                type="button"
                onClick={() => setActiveTab("settings")}
              >
                AI settings
              </button>
              <button
                aria-selected={activeTab === "materials"}
                role="tab"
                type="button"
                onClick={() => setActiveTab("materials")}
              >
                Materials
              </button>
            </div>

            {activeTab === "settings" ? (
              <form className="class-settings-form" key={selectedClass.id} onSubmit={submitSettings}>
              <div className="panel-heading compact-heading">
                <div>
                  <p className="eyebrow">AI behavior</p>
                  <h3>Guidance settings</h3>
                </div>
                <button className="secondary-button compact" disabled={isSavingSettings} type="submit">
                  {isSavingSettings ? "Saving" : "Save"}
                </button>
              </div>

              <label className="field-label" htmlFor="settings-name">
                Class name
              </label>
              <input
                id="settings-name"
                name="name"
                required
                defaultValue={selectedClass.name}
              />

              <label className="field-label" htmlFor="settings-section">
                Section
              </label>
              <input
                id="settings-section"
                name="section"
                required
                defaultValue={selectedClass.section}
              />

              <label className="field-label" htmlFor="behavior-title">
                Behavior preset
              </label>
              <input
                id="behavior-title"
                name="behaviorTitle"
                required
                defaultValue={selectedClass.behaviorTitle ?? "Guided problem solving"}
              />

              <label className="field-label" htmlFor="behavior-instructions">
                Hidden tutor instructions
              </label>
              <textarea
                id="behavior-instructions"
                name="behaviorInstructions"
                required
                rows={5}
                defaultValue={selectedClass.behaviorInstructions ?? ""}
              />

              <label className="field-label" htmlFor="refusal-style">
                Redirection style
              </label>
              <textarea
                id="refusal-style"
                name="refusalStyle"
                required
                rows={3}
                defaultValue={selectedClass.refusalStyle ?? ""}
              />
            </form>
            ) : null}

            {activeTab === "roster" ? (
              <div className="roster-editor">
              <div className="panel-heading compact-heading">
                <div>
                  <p className="eyebrow">Roster</p>
                  <h3>{students.length} students</h3>
                </div>
              </div>

              <form className="student-add-form" onSubmit={submitStudent}>
                <label className="field-label" htmlFor="student-name">
                  Student name
                </label>
                <input
                  id="student-name"
                  required
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Maya Rivera"
                />

                <label className="field-label" htmlFor="student-email">
                  Student email
                </label>
                <div>
                  <input
                    id="student-email"
                    required
                    type="email"
                    value={studentEmail}
                    onChange={(event) => setStudentEmail(event.target.value)}
                    placeholder="student@example.com"
                  />
                  <button className="secondary-button compact" disabled={isSavingStudent} type="submit">
                    {isSavingStudent ? "Adding" : "Add"}
                  </button>
                </div>
              </form>

              <div className="student-list">
                {students.map((student) => (
                  <div className="student-row" key={student.id}>
                    <div>
                      <strong>{student.displayName}</strong>
                      <span>{student.email}</span>
                    </div>
                    <span className="status ok">Added</span>
                  </div>
                ))}

                {!students.length ? (
                  <div className="empty-state">
                    <strong>No students yet</strong>
                    <span>Add students by name and email.</span>
                  </div>
                ) : null}
              </div>
            </div>
            ) : null}

            {activeTab === "materials" ? (
              <div className="materials-editor">
              <div className="panel-heading compact-heading">
                <div>
                  <p className="eyebrow">Materials</p>
                  <h3>{materials.length} sources</h3>
                </div>
              </div>

              <form className="material-add-form" onSubmit={submitMaterial}>
                <label className="field-label" htmlFor="material-title">
                  Material title
                </label>
                <input
                  id="material-title"
                  required
                  value={materialTitle}
                  onChange={(event) => setMaterialTitle(event.target.value)}
                  placeholder="Chapter 5 notes"
                />

                <label className="field-label" htmlFor="material-kind">
                  Material type
                </label>
                <select
                  id="material-kind"
                  value={materialKind}
                  onChange={(event) => setMaterialKind(event.target.value)}
                >
                  <option value="lecture-notes">Lecture notes</option>
                  <option value="textbook">Textbook</option>
                  <option value="worked-example">Worked example</option>
                  <option value="assignment">Assignment</option>
                </select>

                <label className="field-label" htmlFor="material-file">
                  Upload text file
                </label>
                <input
                  accept=".pdf,.txt,.md,.csv,.text,application/pdf,text/plain,text/markdown,text/csv"
                  id="material-file"
                  type="file"
                  onChange={(event) => setMaterialFile(event.target.files?.[0] ?? null)}
                />

                <label className="field-label" htmlFor="material-text">
                  Paste material text
                </label>
                <textarea
                  id="material-text"
                  rows={7}
                  value={materialText}
                  onChange={(event) => setMaterialText(event.target.value)}
                  placeholder="Paste notes, examples, assignment instructions, or textbook excerpts..."
                />

                <button className="secondary-button compact" disabled={isSavingMaterial} type="submit">
                  {isSavingMaterial ? "Uploading" : "Upload searchable material"}
                </button>
              </form>

              <div className="material-list">
                {materials.map((material) => (
                  <div className="material-row" key={material.id}>
                    <div>
                      <strong>{material.title}</strong>
                      <span>
                        {material.fileName || material.kind.replace("-", " ")}
                        {material.chunkCount ? ` / ${material.chunkCount} searchable chunks` : ""}
                      </span>
                    </div>
                    <span className="status muted">{material.status}</span>
                  </div>
                ))}

                {!materials.length ? (
                  <div className="empty-state">
                    <strong>No materials yet</strong>
                    <span>Add lecture notes, textbook sections, examples, or assignments.</span>
                  </div>
                ) : null}
              </div>
            </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <strong>Start with a class</strong>
            <span>Your editable roster, behavior settings, and materials will appear here.</span>
          </div>
        )}
      </article>
    </section>
  );
}

async function extractMaterialText(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(apiUrl("/api/materials/extract"), {
    method: "POST",
    body: formData
  });

  const data = (await response.json()) as { error?: string; text?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Material extraction failed.");
  }

  if (!data.text?.trim()) {
    throw new Error("No searchable text was found in that file.");
  }

  return data.text;
}
