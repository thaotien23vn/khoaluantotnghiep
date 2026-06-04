# Giải thích 3 luồng AI trong lms-backend

Tập trung vào 3 luồng chính:
1. `Quiz generation` (tạo quiz / câu hỏi)
2. `Lesson chat` (AI trả lời trong bài giảng)
3. `Student AI tutor` (hội thoại AI theo khóa học)

---

## 1) Quiz generation

File: `src/services/aiContent.service.js`

Hàm chính: `generateQuizQuestions(...)`

- Line ~238: `const systemPrompt = ...`
  - Xác định vai trò AI là "chuyên gia giáo dục".
  - Ghi rõ định dạng trả về phải là JSON array thuần túy.
  - Nêu yêu cầu cho từng loại câu hỏi: `multiple_choice`, `true_false`, `short_answer`.
  - Chỉ đạo AI phải bám sát nội dung bài giảng.

- Line ~254: `const prompt = ...`
  - Cung cấp thông tin về khóa học, chương, lecture.
  - Chèn nội dung bài giảng hiện có: `lecture.content || lecture.aiNotes`.
  - Yêu cầu số câu hỏi, loại câu hỏi, độ khó.
  - Nhắc bắt buộc định dạng JSON.

- Line ~293: `aiResponse = await aiGateway.generateText({...})`
  - Gọi dịch vụ AI thực hiện sinh câu hỏi.
  - Truyền `systemPrompt` và `prompt` vào.
  - Cấu hình token và timeout.

### Đoạn code tham khảo
```js
const systemPrompt = `Bạn là chuyên gia giáo dục tạo câu hỏi kiểm tra chất lượng cao bám sát nội dung bài giảng.

QUY TẮC BẮT BUỘC:
1. CHỈ trả về một JSON array thuần túy, không có text nào ngoài JSON
2. Mỗi câu hỏi PHẢI có đủ 6 trường: type, question, options, correctAnswer, explanation, difficulty
3. Loại multiple_choice: 
   - options là array 4 phần tử ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"]
   - correctAnswer là chỉ một trong: "A", "B", "C" hoặc "D"
4. Loại true_false: 
   - options PHẢI là ["A. True", "B. False"]
   - correctAnswer là "A" (true) hoặc "B" (false)
5. Loại short_answer: correctAnswer là text ngắn, rõ ràng
6. Câu hỏi phải bám sát NỘI DUNG được cung cấp, không tạo câu hỏi ngoài ngữ cảnh
7. explanation phải giải thích rõ tại sao đáp án đúng dựa trên nội dung bài học
8. Tất cả câu hỏi phải ở mức độ độ khó vừa phải (medium) nếu không có yêu cầu khác`;

const prompt = `Tạo ${questionCount} câu hỏi quiz từ nội dung lecture sau:

COURSE: ${lecture.chapter?.course?.title}
CHAPTER: ${lecture.chapter?.title}
LECTURE: ${lecture.title}

NỘI DUNG BÀI GIẢNG:
${lecture.content || lecture.aiNotes || 'Nội dung không available'}

YÊU CẦU:
- Số câu hỏi: ${questionCount}
- Loại câu hỏi được phép: ${questionTypes.join(', ')}
- Độ khó: ${difficulty}
- Câu hỏi multiple_choice PHẢI có đúng 4 lựa chọn, true_false PHẢI có 2 lựa chọn

ĐỊNH DẠNG JSON BẮT BUỘC (trả về array, không có text ngoài JSON):
[
  {
    "type": "multiple_choice",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "explanation": "...",
    "difficulty": "medium",
    "topic": "..."
  }
]`;

aiResponse = await aiGateway.generateText({
  system: systemPrompt,
  prompt,
  maxOutputTokens: 8192,
  timeoutMs: 180000,
});
```

---

## 2) Lesson chat AI

File: `src/modules/chat/lessonChat.service.js`

Luồng chính:
- `sendMessage(...)`
- `handleStudentQuestion(...)`
- `generateAiResponse(...)`
- `buildRagPrompt(...)`

### `sendMessage(chatId, userId, content, options = {})`
- Line 189: lưu message học viên vào `LessonMessage`.
- Nếu `senderType === 'student' && !parentId`, gọi `handleStudentQuestion(...)`.
- Với giáo viên/admin reply, chỉ update trạng thái trả lời.

### `handleStudentQuestion(chatId, message)`
- Line 242: lấy `LessonChat` và kiểm tra `aiEnabled`.
- Gọi `getLessonContext(chat.lessonId, message.content)` để lấy RAG context.
- Gọi `generateAiResponse(message.content, context)`.
- Nếu `confidence >= 0.7`, lưu câu trả lời AI và đánh dấu message đã trả lời.
- Nếu AI không đủ tự tin, chuyển sang `escalateToTeacher(...)`.

### `generateAiResponse(question, context)`
- Line 315: xây prompt bằng `this.buildRagPrompt(question, context)`.
- Gọi `aiGateway.generateText({...})` với:
  - system: `Bạn là trợ giảng AI...`
  - prompt: nội dung bài học + câu hỏi
  - maxOutputTokens: 2000
  - temperature: 0.3

### `buildRagPrompt(question, context)`
- Line 399: xây prompt như sau:
```text
Bài học: ${context.title}

Nội dung bài học:
${context.content?.substring(0, 3000) || 'Không có nội dung'}

Câu hỏi: ${question}

Trả lời dựa trên nội dung bài học trên. Nếu không có thông tin, hãy nói "Tôi không chắc chắn". Chỉ trả lời nếu bạn confident > 70%.
```
`
- Mục đích: cung cấp context gần nhất, yêu cầu AI chỉ dùng nội dung bài học.

### Đoạn code tham khảo
```js
const prompt = this.buildRagPrompt(question, context);

const response = await aiGateway.generateText({
  system: 'Bạn là trợ giảng AI. Trả lời câu hỏi dựa trên nội dung bài học. Nếu không chắc chắn, hãy nói rõ.',
  prompt,
  maxOutputTokens: 2000,
  temperature: 0.3,
  timeoutMs: 120000,
});
```

---

## 3) Student AI tutor

File: `src/modules/ai/ai.service.js`

Hàm: `sendStudentMessage(userId, role, conversationId, message)`

- Line 216: lấy `system` từ `this.getTemplateOrDefault('tutor')`.
- Line 218: xây prompt theo dạng `CONTEXT` + `QUESTION`.
- `contextText` gồm các chunk RAG: mỗi phần là `#1 (score=...):\n${c.text}`.
- Gọi `this.generateText({...})` để AI trả lời.
- Lưu `AiMessage` với sender `'ai'`.

### Prompt mẫu
```text
CONTEXT:
#1 (score=...):
${chunk.text}

#2 (score=...):
${chunk.text}

QUESTION:
${msg}
```

### Đoạn code tham khảo
```js
const contextText = chunks.map((c, idx) => `#${idx + 1} (score=${c.score?.toFixed?.(3) || 0}):\n${c.text}`).join('\n\n');
const system = await this.getTemplateOrDefault('tutor');

const prompt = [
  'CONTEXT:',
  contextText || '(no context found)',
  '',
  'QUESTION:',
  msg,
].join('\n');

const aiRes = await this.generateText({
  system,
  prompt,
  maxOutputTokens: Number(policy.maxOutputTokens) || Number(process.env.AI_MAX_OUTPUT_TOKENS || 1024) || 1024,
  timeoutMs: 60000,
});
```

- `system` là hướng dẫn role chuyên sâu cho tutor.
- `prompt` đưa vào nội dung RAG và câu hỏi thực tế.

---

## Ghi chú thêm
- `aiGateway.generateText(...)` là điểm gọi chung tới dịch vụ AI.
- `lessonChat` dùng RAG theo bài học và đánh giá confidence.
- `student AI tutor` dùng conversation và RAG chunks theo `courseId`/`lectureId`.
- `quiz generation` yêu cầu AI trả về JSON cấu trúc rõ ràng.
