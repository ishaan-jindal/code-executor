# Debug Platform – Single-File Debugging Challenge Engine

A backend service for **debugging-style coding challenges** where participants are expected to **fix bugs in an existing codebase**, not rewrite solutions from scratch.

The platform evaluates submissions in **two strictly separated phases**:

1. **Functional correctness** (sandboxed execution with testcases)
2. **Debug-effort similarity** (to ensure minimal, genuine fixes)

This system is **not a plagiarism checker**.
It is a **debugging fidelity evaluator**.

---

## Supported Languages

Currently supported:

* **C**
* **Python**

---

## Core Design Principles

* **Correctness always comes first**
* **Similarity is evaluated only after correctness**
* **Single-file challenges only**
* **Language is defined by the challenge, never by the user**
* **High similarity is good** (debugging ≠ rewriting)
* **Formatting and variable renames are allowed**
* **Rewrites are penalized even if correct**
* **All execution is sandboxed using Docker**

---

## Project Structure

```
debug-platform/
├── docker/
│   ├── c.Dockerfile
│   ├── py.Dockerfile
│
├── runner/
│   ├── runSingleTest.js
│   ├── runTestcases.js
│   └── outputMatch.js
│
├── limits/
│   └── executionLimiter.js
│
├── similarity/
│   ├── normalize.js
│   ├── lineClassifier.js
│   ├── weightedDiff.js
│   ├── locality.js
│   ├── anchors.js
│   ├── hardcode.js
│   ├── scoreCompose.js
│   └── index.js
│
├── challenges/
│   └── example.json
│
├── logs/
│   └── requestLogger.js
│
├── utils/
│   └── apiError.js
│
├── server.js
├── package.json
└── README.md
```

---

## Challenge Definition (`challenges/*.json`)

Each challenge is defined as a JSON file.
**This file is authoritative and server-only.**

### Example Challenge

```json
{
  "title": "Square of a Number",
  "language": "c",
  "debugCode": "<debug code here>",
  "baseCode": "#include <stdio.h>\n\nint main() {\n    int n;\n    scanf(\"%d\", &n);\n    printf(\"%d\\n\", n * n + 1);\n    return 0;\n}\n",
  "testcases": [
    { "input": "2\n", "expected": "4" },
    { "input": "5\n", "expected": "25" },
    { "input": "10\n", "expected": "100" }
  ],
  "anchors": ["scanf", "printf"],
  "similarityThreshold": 70,
  "description": "Fix the bug so the program prints the square of the input.",
  "sampleInput": "5",
  "sampleOutput": "25"
}
```

---

### Challenge Fields Explained

| Field                 | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `title`               | Human-readable challenge title                                |
| `language`            | Execution language (`c`, `python`)                            |
| `baseCode`            | Buggy reference implementation (entire file as a string)      |
| `testcases`           | List of stdin/stdout pairs (server-only)                      |
| `anchors`             | *(Optional)* semantic landmarks preserved during debugging    |
| `similarityThreshold` | Minimum similarity % required **after** passing all testcases |
| `description`         | Problem description (safe to expose)                          |
| `sampleInput`         | Example input (safe to expose)                                |
| `sampleOutput`        | Example output (safe to expose)                               |

---

## Anchors (Important Concept)

**Anchors are semantic landmarks**, not strict requirements.

They answer the question:

> *Did the participant preserve the original algorithm while fixing bugs?*

### Good Anchors

* Function names
* Helper utilities
* Macros
* Algorithm-specific strings
* Key helper calls

### Bad Anchors

* Variable names
* Formatting
* Language keywords
* Magic numbers

### Anchor Rules

* Anchors **never block correctness**
* Anchors **only influence similarity**
* Anchors **scale with problem complexity**
* Small challenges may have **no anchors**

---

## API Overview

### `POST /submit`

Submit a solution for evaluation.

#### Request Body

```json
{
  "challengeId": "example",
  "submittedCode": "<FULL SOURCE FILE AS STRING>"
}
```

Rules:

* `submittedCode` must contain the **entire file**
* Language is inferred from the challenge
* Text files only
* Maximum size: **100 KB**

---

### `GET /challenges`

List all available challenges (metadata only).

#### Response

```json
[
  {
    "id": "example",
    "language": "c",
    "title": "Square of a Number"
  }
]
```

This endpoint is safe and **does not expose testcases or scoring logic**.

---

### `GET /challenges/:id`

Fetch a single debugging challenge.

#### Response

```json
{
  "id": "example",
  "title": "Square of a Number",
  "language": "c",
  "description": "Fix the bug so the program prints the square of the input.",
  "debugCode": "#include <stdio.h> ...",
  "sampleInput": "5",
  "sampleOutput": "25"
}
```

⚠️ **Never exposed**:

* Testcases
* Expected outputs
* Anchors
* Similarity threshold

---

## Evaluation Flow (Strict Order)

1. **Run all testcases**
2. If any testcase fails → return immediately
3. If all testcases pass:

   * Compute similarity
   * Compare against threshold
4. Return results **clearly separated**

👉 **Similarity is never computed if testcases fail.**

---

## Response Formats

### ❌ Testcases Failed

```json
{
  "testcases": {
    "status": "failed",
    "reason": "wrong-output",
    "testcase": 2
  }
}
```

Possible reasons:

* `runtime-error`
* `wrong-output`

---

### ✅ Testcases Passed, Similarity Failed

```json
{
  "testcases": { "status": "passed" },
  "similarity": {
    "score": 58.44,
    "passed": false,
    "breakdown": {
      "weighted": 60.12,
      "locality": 80.00,
      "anchors": 33.33,
      "structure": 70.00,
      "penalty": -10.00
    },
    "threshold": 70
  }
}
```

---

### ✅ Testcases Passed, Similarity Passed

```json
{
  "testcases": { "status": "passed" },
  "similarity": {
    "score": 94.23,
    "passed": true,
    "breakdown": {
      "weighted": 100.00,
      "locality": 100.00,
      "anchors": 100.00,
      "structure": 100.00,
      "penalty": 0.00
    },
    "threshold": 70
  }
}
```

All similarity values are **rounded to 2 decimal places**.

---

## Similarity Scoring (v2 – Debug-Aware)

```
Final Score =
  40% Weighted Line Similarity
+ 20% Edit Locality
+ 20% Anchor Preservation
+ 20% Structural Similarity
+ Penalties
```

### Rewards

* Minimal, localized edits
* Preserved control flow
* Variable renames
* Formatting / whitespace changes
* Genuine debugging fixes

### Penalizes

* Full rewrites
* Hardcoded outputs
* Algorithm replacement
* Removing core helpers
* Output-only solutions

---

## Runtime Execution

All code runs inside **Docker sandboxes** with:

* No network access
* Memory limits
* CPU limits
* Execution timeouts
* Process isolation

### Language Runners

| Language | Docker Image         |
| -------- | -------------------- |
| C        | `gcc:13`             |
| Python   | `python:3.12-alpine` |

---

## Concurrency Control

To protect the host system:

* Submissions run through an **in-process execution limiter**
* Only a limited number execute concurrently
* Excess requests wait safely in memory

This prevents:

* Docker overload
* CPU starvation
* Random runtime failures

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

---

### 2. Build Docker Runners

```bash
docker build -t runner-c  -f docker/c.Dockerfile .
docker build -t runner-py -f docker/py.Dockerfile .
```

---

### 3. Docker Permissions (Linux)

```bash
sudo usermod -aG docker $USER
# logout + login required
```

Verify:

```bash
docker ps
```

---

### 4. Start Server

```bash
node server.js
```

Server runs on:

```
http://localhost:4000
```

---

## Submitting Code

### Using `curl`

```bash
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  --data-raw "$(jq -n \
    --arg code "$(cat solution.c)" \
    '{ challengeId: "example", submittedCode: $code }')"
```

---

### From a Frontend

```js
const file = input.files[0];
const code = await file.text();

fetch("/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    challengeId: "example",
    submittedCode: code
  })
});
```

---


| HTTP Code | Meaning                    | When It Occurs                                 |
| --------: | -------------------------- | ---------------------------------------------- |
|       200 | Success / Expected Outcome | Normal execution, testcase failure, similarity |
|       400 | Bad Request                | Missing or invalid request fields              |
|       404 | Not Found                  | Challenge does not exist                       |
|       413 | Payload Too Large          | Submitted code exceeds size limit              |
|       500 | Internal Server Error      | Unexpected server-side failure                 |


---

## Final Notes

* This platform is **debug-first**, not solution-first
* Similarity enforces **debugging discipline**, not plagiarism rules
* Server-side authority is absolute
* Public APIs expose **only safe information**

