import type { RetrievalHit } from "./types";

export function createDemoTutorResponse(question: string, hits: RetrievalHit[]) {
  const source = hits[0];

  if (!source) {
    return [
      "Let's slow the problem down into one move.",
      "",
      "What is the first thing the question is asking you to find or transform? If you paste the exact problem, I will help you choose the next step without jumping straight to the answer."
    ].join("\n");
  }

  return [
    `A helpful place to look is ${source.document.title}, especially the part on ${source.chunk.label}.`,
    "",
    `For your problem, try applying this idea: ${source.chunk.content}`,
    "",
    "Before we go further, what step would you try next? Write just that step, and I will check it."
  ].join("\n");
}

