export type Role = "student" | "teacher" | "assistant" | "system";

export type ModelOption = {
  id: string;
  label: string;
  provider: "openrouter" | "local" | "demo";
  description: string;
};

export type TutorPolicy = {
  id: string;
  courseId: string;
  title: string;
  visibleToStudent: boolean;
  instructions: string[];
  refusalStyle: string;
  retrievalGuidance: string;
};

export type SourceDocument = {
  id: string;
  courseId: string;
  title: string;
  kind: "lecture-notes" | "textbook" | "worked-example" | "assignment";
  status: "ready" | "processing" | "needs-review";
  uploadedAt: string;
  chunks: SourceChunk[];
};

export type SourceChunk = {
  id: string;
  documentId: string;
  label: string;
  content: string;
};

export type Course = {
  id: string;
  name: string;
  section: string;
  activePolicyId: string;
  allowedModelIds: string[];
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  courseId: string;
  studentName: string;
  assignment: string;
  modelId: string;
  messages: ChatMessage[];
  tags: string[];
  lastActiveAt: string;
};

export type RetrievalHit = {
  chunk: SourceChunk;
  document: SourceDocument;
  score: number;
};
