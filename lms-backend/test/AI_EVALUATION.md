# AI Evaluation (Thesis KPIs)

This document defines measurable metrics (KPIs) for evaluating the AI tutor + RAG features in the LMS backend.

## 1) Coverage & Usage

- **Active users (DAU/WAU/MAU)**
- **AI sessions / conversations**
- **Messages per conversation**
- **AI feature usage by role**
  - student
  - teacher
  - admin

## 2) Quality Proxies (No human grading required)

- **RAG context hit rate**
  - % of responses where retrieval returns at least 1 chunk
  - % of responses where top-1 similarity score >= threshold (e.g. 0.75)
- **Answer length**
  - average tokens / chars per response (proxy for verbosity)
- **Grounding indicator**
  - % of answers that mention lecture/course sources (if prompt enforces citations)

## 3) Latency & Reliability

- **Latency** (ms)
  - p50, p95 for
    - embedding calls
    - generate calls
    - full endpoint request (student tutor message)
- **Error rate**
  - AI endpoints error % (4xx vs 5xx)
  - provider errors (Gemini) %

## 4) Cost Proxies

- **Token usage**
  - average input/output tokens per request (if available)
  - daily token usage by role

## 5) Safety & Governance

- **Policy enforcement rate**
  - % requests blocked because AI disabled
  - % requests blocked because role policy disabled
  - % requests blocked due to enrollment/ownership checks
- **Audit coverage**
  - % of AI calls that produce audit logs

## Suggested Experiments

1. **A/B**: RAG topK = 0 vs topK = 5
2. **Prompt variants**: tutor prompt v1 vs v2 (more strict grounding)
3. **Latency stress**: batch message tests under realistic load
