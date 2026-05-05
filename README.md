# Chandra

Chandra is a teacher-guided AI learning platform. Teachers define how an AI tutor should behave for a course or assignment, upload source material, and review student conversations to understand where students are getting stuck.

The first version in this repository is a working product scaffold:

- Student chat experience with course, model, and assignment context.
- Teacher dashboard for behavior controls, hidden instructions, documents, and conversation review.
- Prompt assembly that separates visible classroom guidance from hidden teacher policy.
- Retrieval placeholder that can later be backed by embeddings and vector search.
- Chat API that runs in demo mode without credentials and can call any OpenRouter model when configured.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Firebase Accounts

Chandra uses Firebase Authentication for student and teacher accounts, with Firestore storing the role profile at `users/{uid}`.

1. Create a Firebase project.
2. Add a Web app in Firebase project settings.
3. Enable Authentication -> Sign-in method -> Email/Password.
4. Create a Firestore database.
5. Copy `.env.example` to `.env.local` and fill in the Firebase web app values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Restart `npm run dev` after changing `.env.local`.

Suggested starter Firestore rules for local development:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      allow read, update: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

These rules are intentionally narrow. Teacher access to student conversations should use a course membership model before production.

## Model Provider

Copy `.env.example` to `.env.local` to enable live model calls:

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=openai/gpt-4.1-mini
```

Without `OPENROUTER_API_KEY`, the API returns a guided demo response so the UI remains usable. Teachers can add any OpenRouter model ID from the dashboard, such as `anthropic/claude-3.5-sonnet`, `openai/gpt-4.1-mini`, or `meta-llama/llama-3.1-70b-instruct`.

## Product Direction

Chandra is built around four core objects:

- `Course`: a classroom context with selected model options and teacher-owned policies.
- `TutorPolicy`: behavioral instructions such as "do not give final answers" and whether instructions are hidden from students.
- `SourceDocument`: teacher-uploaded PDFs, notes, examples, and other reference material.
- `Conversation`: recorded student interactions that teachers can review and summarize.

## Near-Term Roadmap

- Authentication and roles for teachers and students.
- Persistent storage for courses, policies, documents, and conversations.
- PDF upload, parsing, chunking, embeddings, and source-grounded retrieval.
- Teacher-generated summaries of common struggles across a class.
- LMS integrations and classroom roster import.
