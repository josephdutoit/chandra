import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from .sample_data import COURSES, DOCUMENTS, TUTOR_POLICIES

load_dotenv(".env.local")

app = FastAPI(title="Chandra API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    createdAt: str


class ChatRequest(BaseModel):
    courseId: str
    modelId: str
    messages: list[ChatMessage]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/materials/extract")
async def extract_material(file: UploadFile = File(...)) -> dict[str, str]:
    contents = await file.read()
    max_upload_bytes = 12 * 1024 * 1024

    if len(contents) > max_upload_bytes:
        raise HTTPException(status_code=400, detail="Files must be 12 MB or smaller.")

    file_name = file.filename or "material"
    is_pdf = file.content_type == "application/pdf" or file_name.lower().endswith(".pdf")

    if is_pdf:
        text = extract_pdf_text(contents)
    else:
        text = contents.decode("utf-8", errors="ignore")

    text = text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="No searchable text was found in that file.")

    return {"fileName": file_name, "text": text}


@app.post("/api/chat")
async def chat(request: ChatRequest) -> dict[str, Any]:
    latest_student_message = next(
        (message for message in reversed(request.messages) if message.role == "student"),
        None,
    )
    question = latest_student_message.content if latest_student_message else ""
    retrieval_hits = await retrieve_course_context(request.courseId, question)
    system_prompt = await build_tutor_system_prompt(request.courseId, retrieval_hits)

    if not os.getenv("OPENROUTER_API_KEY") or request.modelId == "demo-guided":
        return {
            "content": create_demo_tutor_response(question, retrieval_hits),
            "sources": [
                {"documentTitle": hit["document"]["title"], "label": hit["chunk"]["label"]}
                for hit in retrieval_hits
            ],
        }

    response_text = await call_openrouter(request.modelId, system_prompt, request.messages)
    return {
        "content": response_text,
        "sources": [
            {"documentTitle": hit["document"]["title"], "label": hit["chunk"]["label"]}
            for hit in retrieval_hits
        ],
    }


def extract_pdf_text(contents: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as error:
        raise HTTPException(
            status_code=500,
            detail="PDF support is not installed. Run `pip install -r backend/requirements.txt`.",
        ) from error

    from io import BytesIO

    reader = PdfReader(BytesIO(contents))
    page_text = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(page_text)


async def retrieve_course_context(course_id: str, query: str, limit: int = 3) -> list[dict[str, Any]]:
    terms = tokenize(query)
    documents = [*DOCUMENTS, *(await get_firestore_material_documents(course_id))]
    hits: list[dict[str, Any]] = []

    for document in documents:
        if document["courseId"] != course_id or document["status"] != "ready":
            continue

        for chunk in document["chunks"]:
            score = score_chunk(chunk["content"], terms)

            if score > 0:
                hits.append({"document": document, "chunk": chunk, "score": score})

    return sorted(hits, key=lambda hit: hit["score"], reverse=True)[:limit]


async def get_firestore_material_documents(class_id: str) -> list[dict[str, Any]]:
    project_id = os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    api_key = os.getenv("NEXT_PUBLIC_FIREBASE_API_KEY")

    if not project_id or not api_key:
        return []

    base_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"
    materials_url = f"{base_url}/classes/{class_id}/materials?key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            materials_response = await client.get(materials_url)

            if materials_response.status_code >= 400:
                return []

            materials = materials_response.json().get("documents", [])
            documents = []

            for material in materials:
                material_name = material["name"]
                material_id = material_name.rsplit("/", 1)[-1]
                fields = material.get("fields", {})
                chunks_url = f"{base_url}/classes/{class_id}/materials/{material_id}/chunks?key={api_key}"
                chunks_response = await client.get(chunks_url)
                chunk_documents = chunks_response.json().get("documents", []) if chunks_response.status_code < 400 else []

                documents.append(
                    {
                        "id": material_id,
                        "courseId": class_id,
                        "title": firestore_string(fields.get("title")) or "Uploaded material",
                        "kind": firestore_string(fields.get("kind")) or "lecture-notes",
                        "status": firestore_string(fields.get("status")) or "ready",
                        "chunks": [
                            {
                                "id": chunk["name"].rsplit("/", 1)[-1],
                                "documentId": material_id,
                                "label": firestore_string(chunk.get("fields", {}).get("label")) or "Uploaded excerpt",
                                "content": firestore_string(chunk.get("fields", {}).get("content")) or "",
                            }
                            for chunk in chunk_documents
                        ],
                    }
                )

            return documents
    except httpx.HTTPError:
        return []


async def build_tutor_system_prompt(course_id: str, retrieval_hits: list[dict[str, Any]]) -> str:
    course = next((item for item in COURSES if item["id"] == course_id), None)
    policy = next((item for item in TUTOR_POLICIES if item["id"] == (course or {}).get("activePolicyId")), None)
    teacher_class = None if course else await get_firestore_class(course_id)

    source_context = (
        "\n\n".join(
            f"Source {index + 1}: {hit['document']['title']} - {hit['chunk']['label']}\n{hit['chunk']['content']}"
            for index, hit in enumerate(retrieval_hits)
        )
        if retrieval_hits
        else "No matching source context was retrieved."
    )

    if teacher_class or not course:
        class_name = (teacher_class or {}).get("name", "this class")
        section = (teacher_class or {}).get("section", "student workspace")
        behavior_title = (teacher_class or {}).get("behaviorTitle", "Guided problem solving")
        behavior_instructions = (teacher_class or {}).get(
            "behaviorInstructions",
            "Guide the student through the next step without simply giving final answers.",
        )
        refusal_style = (teacher_class or {}).get(
            "refusalStyle",
            "If a student asks for a direct answer, redirect them toward the next useful step.",
        )
        instructions = [
            line.strip()
            for line in behavior_instructions.splitlines()
            if line.strip()
        ]

        return "\n".join(
            [
                f"You are Chandra, an AI tutor for {class_name} ({section}).",
                "Your goal is to help the student learn, not to simply complete work for them.",
                f"Teacher policy: {behavior_title}",
                *[f"- {instruction}" for instruction in instructions],
                f"Refusal and redirection style: {refusal_style}",
                "When using source material, mention the source title naturally.",
                "Use LaTeX for math expressions.",
                "\nRetrieved course context:",
                source_context,
            ]
        )

    if not course or not policy:
        raise HTTPException(status_code=400, detail="Course policy not found.")

    return "\n".join(
        [
            f"You are Chandra, an AI tutor for {course['name']} ({course['section']}).",
            "Your goal is to help the student learn, not to simply complete work for them.",
            f"Teacher policy: {policy['title']}",
            *[f"- {instruction}" for instruction in policy["instructions"]],
            f"Refusal and redirection style: {policy['refusalStyle']}",
            f"Retrieval guidance: {policy['retrievalGuidance']}",
            "When using source material, mention the source title naturally.",
            "Use LaTeX for math expressions.",
            "\nRetrieved course context:",
            source_context,
        ]
    )


async def get_firestore_class(class_id: str) -> dict[str, str] | None:
    project_id = os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    api_key = os.getenv("NEXT_PUBLIC_FIREBASE_API_KEY")

    if not project_id or not api_key:
        return None

    url = (
        f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)"
        f"/documents/classes/{class_id}?key={api_key}"
    )

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(url)

        if response.status_code >= 400:
            return None

        fields = response.json().get("fields", {})
        return {
            "behaviorInstructions": firestore_string(fields.get("behaviorInstructions")) or "",
            "behaviorTitle": firestore_string(fields.get("behaviorTitle")) or "",
            "name": firestore_string(fields.get("name")) or "Class",
            "refusalStyle": firestore_string(fields.get("refusalStyle")) or "",
            "section": firestore_string(fields.get("section")) or "Workspace",
        }
    except httpx.HTTPError:
        return None


async def call_openrouter(model_id: str, system_prompt: str, messages: list[ChatMessage]) -> str:
    payload = {
        "model": model_id or os.getenv("DEFAULT_MODEL", "openai/gpt-4.1-mini"),
        "messages": [
            {"role": "system", "content": system_prompt},
            *[
                {
                    "role": "user" if message.role == "student" else "assistant",
                    "content": message.content,
                }
                for message in messages
                if message.role in {"student", "assistant"}
            ],
        ],
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
        "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost:3000"),
        "X-Title": os.getenv("OPENROUTER_APP_TITLE", "Chandra"),
    }

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
            + "/chat/completions",
            json=payload,
            headers=headers,
        )

    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"] or "I could not generate a response."


def create_demo_tutor_response(question: str, retrieval_hits: list[dict[str, Any]]) -> str:
    source_line = ""

    if retrieval_hits:
        source_line = f"\n\nI found a relevant source: {retrieval_hits[0]['document']['title']}."

    return (
        "Let's slow the problem down into one move.\n\n"
        "What is the first thing the question is asking you to find or transform? "
        "If you paste the exact problem, I will help you choose the next step without jumping straight to the answer."
        f"{source_line}"
    )


def tokenize(value: str) -> list[str]:
    return [term for term in re.sub(r"[^a-z0-9\s-]", " ", value.lower()).split() if len(term) > 2]


def score_chunk(content: str, terms: list[str]) -> int:
    normalized = content.lower()
    return sum(1 for term in terms if term in normalized)


def firestore_string(field: dict[str, Any] | None) -> str:
    if not field:
        return ""

    return str(field.get("stringValue", ""))
