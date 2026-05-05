import { doc, getDoc } from "firebase/firestore";
import { serverDb } from "./firebase-server";
import { courses, tutorPolicies } from "./sample-data";
import type { ChatMessage, RetrievalHit } from "./types";

export async function buildTutorSystemPrompt({
  courseId,
  retrievalHits
}: {
  courseId: string;
  retrievalHits: RetrievalHit[];
}) {
  const course = courses.find((item) => item.id === courseId);
  const policy = tutorPolicies.find((item) => item.id === course?.activePolicyId);
  const teacherClass = !course ? await getTeacherClass(courseId) : null;

  const sourceContext = retrievalHits.length
    ? retrievalHits
        .map(
          (hit, index) =>
            `Source ${index + 1}: ${hit.document.title} - ${hit.chunk.label}\n${hit.chunk.content}`
        )
        .join("\n\n")
    : "No matching source context was retrieved.";

  if (teacherClass || !course) {
    const className = teacherClass?.name ?? "this class";
    const classSection = teacherClass?.section ?? "student workspace";
    const instructions = teacherClass?.behaviorInstructions
      ? teacherClass.behaviorInstructions
          .split("\n")
          .map((instruction) => instruction.trim())
          .filter(Boolean)
      : ["Guide the student through the next step without simply giving final answers."];

    return [
      `You are Chandra, an AI tutor for ${className} (${classSection}).`,
      "Your goal is to help the student learn, not to simply complete work for them.",
      `Teacher policy: ${teacherClass?.behaviorTitle ?? "Guided problem solving"}`,
      ...instructions.map((instruction) => `- ${instruction}`),
      `Refusal and redirection style: ${
        teacherClass?.refusalStyle ??
        "If a student asks for a direct answer, redirect them toward the next useful step."
      }`,
      "When using source material, mention the source title naturally.",
      "Use LaTeX for math expressions.",
      "\nRetrieved course context:",
      sourceContext
    ].join("\n");
  }

  if (!course || !policy) {
    throw new Error("Course policy not found");
  }

  return [
    `You are Chandra, an AI tutor for ${course.name} (${course.section}).`,
    "Your goal is to help the student learn, not to simply complete work for them.",
    `Teacher policy: ${policy.title}`,
    ...policy.instructions.map((instruction) => `- ${instruction}`),
    `Refusal and redirection style: ${policy.refusalStyle}`,
    `Retrieval guidance: ${policy.retrievalGuidance}`,
    "When using source material, mention the source title naturally.",
    "Use LaTeX for math expressions.",
    "\nRetrieved course context:",
    sourceContext
  ].join("\n");
}

async function getTeacherClass(courseId: string) {
  if (!serverDb) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(serverDb, "classes", courseId));

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      behaviorInstructions: data.behaviorInstructions as string | undefined,
      behaviorTitle: data.behaviorTitle as string | undefined,
      name: String(data.name ?? "Class"),
      refusalStyle: data.refusalStyle as string | undefined,
      section: String(data.section ?? "Workspace")
    };
  } catch {
    return null;
  }
}

export function visiblePolicySummary(courseId: string) {
  const course = courses.find((item) => item.id === courseId);
  const policy = tutorPolicies.find((item) => item.id === course?.activePolicyId);

  if (!policy || !policy.visibleToStudent) {
    return null;
  }

  return policy.instructions.join(" ");
}

export function toProviderMessages(systemPrompt: string, messages: ChatMessage[]) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...messages
      .filter((message) => message.role === "student" || message.role === "assistant")
      .map((message) => ({
        role: message.role === "student" ? ("user" as const) : ("assistant" as const),
        content: message.content
      }))
  ];
}
