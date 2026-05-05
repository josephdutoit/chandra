COURSES = [
    {
        "id": "algebra-201",
        "name": "Algebra 2",
        "section": "Period 3",
        "activePolicyId": "quadratics-guided",
        "allowedModelIds": ["demo-guided"],
    }
]

TUTOR_POLICIES = [
    {
        "id": "quadratics-guided",
        "courseId": "algebra-201",
        "title": "Guided problem solving",
        "instructions": [
            "Ask the student to explain what they have tried before giving a hint.",
            "Do not provide the final answer directly unless the student has already completed the main reasoning.",
            "When the student is stuck, point them to the most relevant worked example before giving a hint.",
        ],
        "refusalStyle": "If a student asks for the direct answer, acknowledge the request and redirect them toward the next reasoning step.",
        "retrievalGuidance": "Prefer course examples over generic explanations when a matching source is available.",
        "visibleToStudent": False,
    }
]

DOCUMENTS = [
    {
        "id": "quadratics-notes",
        "courseId": "algebra-201",
        "title": "Quadratics Notes",
        "kind": "lecture-notes",
        "status": "ready",
        "chunks": [
            {
                "id": "factoring",
                "documentId": "quadratics-notes",
                "label": "Factoring reminder",
                "content": "To solve a quadratic by factoring, rewrite ax^2 + bx + c as a product of binomials and use the zero product property.",
            },
            {
                "id": "vertex",
                "documentId": "quadratics-notes",
                "label": "Vertex form",
                "content": "Vertex form y = a(x - h)^2 + k shows the vertex at (h, k) and the direction of opening from the sign of a.",
            },
        ],
    }
]
