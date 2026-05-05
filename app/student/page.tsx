"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { AuthNav } from "@/components/AuthNav";
import { RequireAuth } from "@/components/RequireAuth";
import { apiUrl } from "@/lib/api-client";
import { customModelStorageKey } from "@/lib/model-options";
import { courses, modelOptions } from "@/lib/sample-data";
import type { ChatMessage, ModelOption } from "@/lib/types";

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi. I can help you work through the assignment step by step. What problem are you on?",
    createdAt: new Date().toISOString()
  }
];

export default function StudentPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useState("demo-guided");
  const [isSending, setIsSending] = useState(false);
  const [customModels] = useState<ModelOption[]>(readCustomModels);
  const course = courses[0];
  const isTeacherPreview = searchParams.get("preview") === "teacher";
  const activeCourseId = searchParams.get("classId") ?? course.id;

  const allowedModels = useMemo(
    () => {
      const baseModels = modelOptions.filter((model) => course.allowedModelIds.includes(model.id));
      const nextModels = [...baseModels];

      for (const model of customModels) {
        if (!nextModels.some((nextModel) => nextModel.id === model.id)) {
          nextModels.push(model);
        }
      }

      return nextModels;
    },
    [course.allowedModelIds, customModels]
  );

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    const studentMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "student",
      content,
      createdAt: new Date().toISOString()
    };

    const nextMessages = [...messages, studentMessage];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: activeCourseId,
          modelId,
          messages: nextMessages
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as { content: string };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          createdAt: new Date().toISOString()
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I could not reach the tutor service. Try again in a moment.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="shell chat-shell">
      <nav className="topbar">
        <Link className="brand" href="/">
          Chandra
        </Link>
        <AuthNav />
      </nav>

      <RequireAuth role={isTeacherPreview ? ["student", "teacher"] : "student"}>
        <section className="chat-layout">
          <aside className="student-sidebar">
            <p className="eyebrow">{isTeacherPreview ? "Student view" : course.name}</p>
            <h1>{course.section}</h1>
            {isTeacherPreview ? (
              <Link className="secondary-button preview-exit" href="/teacher">
                Back to dashboard
              </Link>
            ) : null}

            <label className="field-label" htmlFor="model">
              Model
            </label>
            <select id="model" value={modelId} onChange={(event) => setModelId(event.target.value)}>
              {allowedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </aside>

          <section className="chat-panel" aria-label="Student tutor chat">
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-meta">{message.role === "student" ? "You" : "Chandra"}</div>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {message.content}
                  </ReactMarkdown>
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <textarea
                aria-label="Message Chandra"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about a problem, step, or equation..."
                rows={3}
              />
              <button type="submit" disabled={isSending || !draft.trim()}>
                {isSending ? "Sending" : "Send"}
              </button>
            </form>
          </section>
        </section>
      </RequireAuth>
    </main>
  );
}

function readCustomModels() {
  if (typeof window === "undefined") {
    return [];
  }

  const savedModels = window.localStorage.getItem(customModelStorageKey);

  if (!savedModels) {
    return [];
  }

  try {
    const parsedModels = JSON.parse(savedModels) as ModelOption[];
    return parsedModels.filter((model) => model.provider === "openrouter");
  } catch {
    window.localStorage.removeItem(customModelStorageKey);
    return [];
  }
}
