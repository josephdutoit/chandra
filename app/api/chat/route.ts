import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createDemoTutorResponse } from "@/lib/demo-tutor";
import { buildTutorSystemPrompt, toProviderMessages } from "@/lib/prompts";
import { retrieveCourseContext } from "@/lib/retrieval";

const chatRequestSchema = z.object({
  courseId: z.string(),
  modelId: z.string(),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["student", "teacher", "assistant", "system"]),
      content: z.string(),
      createdAt: z.string()
    })
  )
});

export async function POST(request: Request) {
  const parsed = chatRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
  }

  const { courseId, messages, modelId } = parsed.data;
  const latestStudentMessage = [...messages].reverse().find((message) => message.role === "student");
  const question = latestStudentMessage?.content ?? "";
  const retrievalHits = await retrieveCourseContext(courseId, question);
  const systemPrompt = await buildTutorSystemPrompt({ courseId, retrievalHits });

  if (!process.env.OPENROUTER_API_KEY || modelId === "demo-guided") {
    return NextResponse.json({
      content: createDemoTutorResponse(question, retrievalHits),
      sources: retrievalHits.map((hit) => ({
        documentTitle: hit.document.title,
        label: hit.chunk.label
      }))
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Chandra"
    }
  });

  const completion = await client.chat.completions.create({
    model: modelId || process.env.DEFAULT_MODEL || "openai/gpt-4.1-mini",
    messages: toProviderMessages(systemPrompt, messages),
    temperature: 0.4
  });

  return NextResponse.json({
    content: completion.choices[0]?.message.content ?? "I could not generate a response.",
    sources: retrievalHits.map((hit) => ({
      documentTitle: hit.document.title,
      label: hit.chunk.label
    }))
  });
}
