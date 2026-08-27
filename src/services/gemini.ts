/**
 * MyPath AI — Gemini AI Service
 * 
 * Handles all AI interactions including:
 * - AI Interview (multi-turn chat)
 * - Student Profile analysis (structured output)
 * - Career recommendations (structured output)
 * - Study plan generation (structured output)
 * 
 * Sử dụng @google/genai SDK gọi trực tiếp từ client cho MVP.
 * Production nên chuyển sang Cloud Functions.
 */

import { GoogleGenAI } from '@google/genai';
import type {
  StudentProfile,
  CareerRecommendation,
  SubjectPriority,
  ScheduleEntry,
  StudyAvailability,
} from '@/types';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Initialize Gemini client
const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm vào file .env.local');
  }
  return new GoogleGenAI({ apiKey });
};

const RETRY_DELAYS_MS = [700, 1_500];

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|RESOURCE_EXHAUSTED|408|429|500|502|503|504|UNAVAILABLE|fetch|network|timeout/i.test(message);
}

async function withGeminiRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

export function getGeminiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/VITE_GEMINI_API_KEY|API key|API_KEY|401|403|PERMISSION_DENIED/i.test(message)) {
    return 'Gemini chưa được cấu hình hoặc API key không có quyền sử dụng mô hình này.';
  }
  if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
    return 'Gemini đang quá tải hoặc tài khoản đã chạm giới hạn tạm thời. Vui lòng thử lại sau ít phút.';
  }
  if (/fetch|network|Failed to fetch|timeout/i.test(message)) {
    return 'Kết nối Internet hoặc máy chủ Gemini đang không ổn định. Mình đã tự thử lại, bạn hãy gửi lại câu trả lời nhé.';
  }
  if (/empty_response/i.test(message)) {
    return 'AI đang gặp chút trục trặc. Bạn cứ gửi lại tin nhắn nhé, mình sẽ xử lý ngay! 🔄';
  }
  return 'Máy chủ AI đang gặp lỗi tạm thời. Vui lòng thử lại sau ít phút.';
}

// ============================================================
// SYSTEM PROMPTS
// ============================================================

const INTERVIEW_SYSTEM_PROMPT = `Bạn là MyPath AI — một trợ lý hướng nghiệp AI thân thiện, chuyên giúp học sinh THPT Việt Nam khám phá bản thân và tìm ngành học phù hợp.

## Vai trò của bạn
Bạn đang thực hiện một cuộc phỏng vấn hướng nghiệp với học sinh. Mục tiêu là tìm hiểu sâu về:
1. **Sở thích và đam mê**: Học sinh thích làm gì trong thời gian rảnh? Có hoạt động nào khiến các em quên thời gian?
2. **Điểm mạnh**: Học sinh giỏi gì? Bạn bè/thầy cô thường khen điều gì?
3. **Điểm yếu**: Học sinh cảm thấy khó khăn ở đâu? Muốn cải thiện điều gì?
4. **Môn học yêu thích và không thích**: Môn nào hứng thú nhất? Môn nào không thích? Tại sao?
5. **Phong cách học tập**: Học tốt nhất khi nào? Thích học một mình hay nhóm? Học qua đọc, nghe hay làm?
6. **Mục tiêu tương lai**: Học sinh mơ ước về công việc/cuộc sống như thế nào?
7. **Lĩnh vực quan tâm**: Công nghệ, y tế, kinh doanh, nghệ thuật, khoa học...?

## Giới hạn bắt buộc
- Câu mở đầu trên giao diện đã được tính là câu hỏi số 1. Chỉ hỏi thêm tối đa 6 lượt nữa, tổng cộng không quá 7 câu hỏi.
- Ưu tiên câu hỏi có thể khai thác được nhiều thông tin: sở thích, môn học, điểm mạnh/yếu, cách học, mục tiêu và lĩnh vực quan tâm.
- Mỗi lượt chỉ hỏi 1 câu hỏi chính (có thể có một câu phụ rất ngắn nếu thật sự cần thiết).
- Hỏi follow-up thông minh dựa trên câu trả lời trước đó
- Giữ giọng điệu thân thiện, như đang nói chuyện với bạn bè cùng tuổi
- Dùng emoji phù hợp để tạo cảm giác gần gũi
- KHÔNG hỏi nhiều câu cùng lúc
- KHÔNG dùng ngôn ngữ quá trang trọng
- Khi đã đủ thông tin hoặc ngay sau khi học sinh trả lời câu hỏi thứ 7, không hỏi thêm bất kỳ câu nào. Hãy nói: "Cảm ơn bạn đã chia sẻ! Mình đã hiểu khá rõ về bạn rồi. Mình sẽ bắt đầu tạo lộ trình học tập cá nhân hóa cho bạn nhé! 🎯"
- Kết thúc tin nhắn cuối cùng bằng marker: [INTERVIEW_COMPLETE]

## Lưu ý quan trọng
- Luôn trả lời bằng tiếng Việt
- Đừng đưa ra đề xuất ngành nghề trong giai đoạn này
- Tập trung vào việc lắng nghe và hiểu học sinh`;

const PROFILE_ANALYSIS_PROMPT = `Bạn là MyPath AI. Dựa trên cuộc phỏng vấn sau đây với học sinh, hãy phân tích và trích xuất Student Profile.

Trả về JSON theo đúng schema được yêu cầu. Tất cả nội dung phải bằng tiếng Việt.

Lưu ý:
- interests: Liệt kê 3-6 sở thích chính
- strengths: Liệt kê 3-5 điểm mạnh
- weaknesses: Liệt kê 2-4 điểm yếu cần cải thiện
- favoriteSubjects: Các môn học yêu thích
- dislikedSubjects: Các môn không thích
- learningStyle: Mô tả phong cách học (1-2 câu)
- goals: 2-4 mục tiêu tương lai
- careerInterests: 2-4 lĩnh vực quan tâm
- personality: Mô tả tính cách tổng quát (2-3 câu)`;

const CAREER_RECOMMENDATION_PROMPT = `Bạn là MyPath AI. Dựa trên Student Profile sau đây, hãy đề xuất 4-5 ngành học phù hợp nhất cho học sinh.

Cho mỗi ngành, cung cấp:
- name: Tên ngành bằng tiếng Anh
- nameVi: Tên ngành bằng tiếng Việt
- matchPercentage: Phần trăm phù hợp (70-98%, hãy thực tế)
- whyItFits: Giải thích TẠI SAO ngành này phù hợp (3-4 câu, bằng tiếng Việt)
- relevantStrengths: Những điểm mạnh nào của học sinh phù hợp
- relevantInterests: Những sở thích nào liên quan
- requiredSkills: Kỹ năng cần thiết cho ngành
- areasToImprove: Những điểm yếu cần cải thiện để theo ngành này

Sắp xếp theo matchPercentage từ cao xuống thấp.
Trả về JSON theo đúng schema được yêu cầu.`;

const SUBJECT_PRIORITY_PROMPT = `Bạn là MyPath AI. Học sinh đã chọn ngành mục tiêu. Dựa trên ngành được chọn và Student Profile, hãy xác định các môn học THPT cần ưu tiên.

Cho mỗi môn:
- name: Tên môn học (tiếng Việt)
- priority: "high" | "medium" | "low"
- targetGrade: Điểm mục tiêu (thang 10)
- reason: Lý do tại sao môn này quan trọng cho ngành mục tiêu (1-2 câu, tiếng Việt)
- currentProgress: Đặt mặc định 0

Liệt kê 4-6 môn quan trọng nhất.
Trả về JSON theo đúng schema.`;

const AVAILABILITY_SYSTEM_PROMPT = `Bạn là MyPath AI. Bây giờ bạn cần hỏi học sinh về thời gian biểu thực tế để lên lịch học.

Bạn cần thu thập:
1. Một tuần có bao nhiêu giờ có thể tự học?
2. Rảnh những ngày nào trong tuần?
3. Mỗi ngày rảnh, khung giờ cụ thể (ví dụ: 19:00-21:00)?
4. Thích học vào buổi sáng, chiều hay tối?
5. Có ngày nào muốn nghỉ hoàn toàn không?

## Quy tắc
- Hỏi ngắn gọn, thân thiện
- Mỗi lượt hỏi 1-2 câu
- Sau 3-5 trao đổi là đủ thông tin
- Khi đã đủ, nói: "Tuyệt vời! Mình đã nắm được lịch của bạn rồi. Để mình xây dựng kế hoạch học tập nhé! 📅"
- Kết thúc bằng marker: [AVAILABILITY_COMPLETE]
- Luôn trả lời bằng tiếng Việt`;

const STUDY_PLAN_PROMPT = `Bạn là MyPath AI. Dựa trên:
1. Ngành mục tiêu của học sinh
2. Các môn học cần ưu tiên
3. Thời gian biểu khả dụng

Hãy xây dựng lịch học tuần chi tiết.

Quy tắc:
- Phân bổ thời gian dựa trên mức ưu tiên (high > medium > low)
- Môn high priority nên có nhiều buổi hơn
- Mỗi buổi học từ 45 phút đến 1.5 giờ (phù hợp với khả năng tập trung)
- Không xếp lịch vào ngày nghỉ của học sinh
- Xếp môn khó vào khung giờ học sinh tập trung tốt nhất
- Đảm bảo tổng thời gian không vượt quá số giờ khả dụng
- dayOfWeek: 1=Thứ 2, 2=Thứ 3, 3=Thứ 4, 4=Thứ 5, 5=Thứ 6, 6=Thứ 7, 7=Chủ nhật
- dayName: Tên ngày bằng tiếng Việt
- Ở trường focusArea (chi tiết học gì), hãy tự lên lịch nội dung học chi tiết theo thứ tự tuần học với mục tiêu học để thi cử.

Trả về JSON theo đúng schema.`;

// ============================================================
// SCHEMAS FOR STRUCTURED OUTPUT
// ============================================================

const PROFILE_SCHEMA = {
  type: 'object' as const,
  properties: {
    interests: { type: 'array' as const, items: { type: 'string' as const } },
    strengths: { type: 'array' as const, items: { type: 'string' as const } },
    weaknesses: { type: 'array' as const, items: { type: 'string' as const } },
    favoriteSubjects: { type: 'array' as const, items: { type: 'string' as const } },
    dislikedSubjects: { type: 'array' as const, items: { type: 'string' as const } },
    learningStyle: { type: 'string' as const },
    goals: { type: 'array' as const, items: { type: 'string' as const } },
    careerInterests: { type: 'array' as const, items: { type: 'string' as const } },
    personality: { type: 'string' as const },
  },
  required: ['interests', 'strengths', 'weaknesses', 'favoriteSubjects', 'dislikedSubjects', 'learningStyle', 'goals', 'careerInterests', 'personality'],
};

const CAREER_SCHEMA = {
  type: 'object' as const,
  properties: {
    careers: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          nameVi: { type: 'string' as const },
          matchPercentage: { type: 'number' as const },
          whyItFits: { type: 'string' as const },
          relevantStrengths: { type: 'array' as const, items: { type: 'string' as const } },
          relevantInterests: { type: 'array' as const, items: { type: 'string' as const } },
          requiredSkills: { type: 'array' as const, items: { type: 'string' as const } },
          areasToImprove: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['name', 'nameVi', 'matchPercentage', 'whyItFits', 'relevantStrengths', 'relevantInterests', 'requiredSkills', 'areasToImprove'],
      },
    },
  },
  required: ['careers'],
};

const SUBJECTS_SCHEMA = {
  type: 'object' as const,
  properties: {
    subjects: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          priority: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
          targetGrade: { type: 'number' as const },
          reason: { type: 'string' as const },
          currentProgress: { type: 'number' as const },
        },
        required: ['name', 'priority', 'targetGrade', 'reason', 'currentProgress'],
      },
    },
  },
  required: ['subjects'],
};

const SCHEDULE_SCHEMA = {
  type: 'object' as const,
  properties: {
    weeklySchedule: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          dayOfWeek: { type: 'number' as const },
          dayName: { type: 'string' as const },
          startTime: { type: 'string' as const },
          endTime: { type: 'string' as const },
          subject: { type: 'string' as const },
          focusArea: { type: 'string' as const },
          priority: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
        },
        required: ['dayOfWeek', 'dayName', 'startTime', 'endTime', 'subject', 'focusArea', 'priority'],
      },
    },
  },
  required: ['weeklySchedule'],
};

const AVAILABILITY_SCHEMA = {
  type: 'object' as const,
  properties: {
    hoursPerWeek: { type: 'number' as const },
    availableDays: { type: 'array' as const, items: { type: 'number' as const } },
    timeSlots: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          dayOfWeek: { type: 'number' as const },
          startTime: { type: 'string' as const },
          endTime: { type: 'string' as const },
        },
        required: ['dayOfWeek', 'startTime', 'endTime'],
      },
    },
    preferredTime: { type: 'string' as const, enum: ['morning', 'afternoon', 'evening'] },
    restDays: { type: 'array' as const, items: { type: 'number' as const } },
  },
  required: ['hoursPerWeek', 'availableDays', 'timeSlots', 'preferredTime', 'restDays'],
};

// ============================================================
// AI SERVICE FUNCTIONS
// ============================================================

/**
 * Tạo chat session cho AI Interview
 */
export function createInterviewChat(history?: Array<{ role: string; parts: Array<{ text: string }> }>) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: INTERVIEW_SYSTEM_PROMPT,
    },
    history: history || [],
  });
  return chat;
}

/**
 * Tạo chat session cho Availability Interview
 */
export function createAvailabilityChat(
  selectedCareer: string,
  subjects: SubjectPriority[],
  history?: Array<{ role: string; parts: Array<{ text: string }> }>
) {
  const ai = getAI();
  const contextMessage = `Học sinh đã chọn ngành mục tiêu: ${selectedCareer}
Các môn cần ưu tiên:
${subjects.map(s => `- ${s.name} (${s.priority})`).join('\n')}

Bây giờ hãy hỏi về thời gian biểu của học sinh.`;

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: AVAILABILITY_SYSTEM_PROMPT + '\n\n' + contextMessage,
    },
    history: history || [],
  });
  return chat;
}

/**
 * Gửi tin nhắn trong chat interview
 */
export async function sendInterviewMessage(
  chat: ReturnType<typeof createInterviewChat>,
  message: string
): Promise<string> {
  const EMPTY_RETRY_DELAYS = [500, 1_000, 2_000];

  for (let attempt = 0; attempt <= EMPTY_RETRY_DELAYS.length; attempt += 1) {
    const msg = attempt === 0 ? message : 'Vui lòng tiếp tục trả lời câu hỏi trước đó.';
    const response = await withGeminiRetry(() => chat.sendMessage({ message: msg }));
    const text = (response.text || '').trim();

    // Log finish reason for debugging
    const candidate = (response as any).candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`Gemini finish reason: ${candidate.finishReason}`);
    }

    if (text) return response.text!;

    if (attempt === EMPTY_RETRY_DELAYS.length) break;

    console.warn(`Gemini trả về chuỗi rỗng (lần ${attempt + 1}/${EMPTY_RETRY_DELAYS.length}), thử lại sau ${EMPTY_RETRY_DELAYS[attempt]}ms...`);
    await new Promise((resolve) => window.setTimeout(resolve, EMPTY_RETRY_DELAYS[attempt]));
  }

  throw new Error('empty_response');
}

/**
 * Phân tích conversation thành Student Profile
 */
export async function analyzeProfile(
  conversationText: string
): Promise<StudentProfile> {
  const ai = getAI();
  const response = await withGeminiRetry(() => ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Đây là nội dung cuộc phỏng vấn:\n\n${conversationText}`,
    config: {
      systemInstruction: PROFILE_ANALYSIS_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: PROFILE_SCHEMA,
    },
  }));
  const parsed = JSON.parse(response.text || '{}');
  return {
    ...parsed,
    completedAt: Date.now(),
  } as StudentProfile;
}

/**
 * Đề xuất ngành học dựa trên Student Profile
 */
export async function recommendCareers(
  profile: StudentProfile
): Promise<CareerRecommendation[]> {
  const ai = getAI();
  const profileText = `Student Profile:
- Sở thích: ${profile.interests.join(', ')}
- Điểm mạnh: ${profile.strengths.join(', ')}
- Điểm yếu: ${profile.weaknesses.join(', ')}
- Môn yêu thích: ${profile.favoriteSubjects.join(', ')}
- Môn không thích: ${profile.dislikedSubjects.join(', ')}
- Phong cách học: ${profile.learningStyle}
- Mục tiêu: ${profile.goals.join(', ')}
- Lĩnh vực quan tâm: ${profile.careerInterests.join(', ')}
- Tính cách: ${profile.personality}`;

  const response = await withGeminiRetry(() => ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: profileText,
    config: {
      systemInstruction: CAREER_RECOMMENDATION_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: CAREER_SCHEMA,
    },
  }));
  const parsed = JSON.parse(response.text || '{"careers":[]}');
  return parsed.careers as CareerRecommendation[];
}

/**
 * Xác định môn học ưu tiên dựa trên ngành mục tiêu
 */
export async function identifySubjectPriorities(
  selectedCareer: string,
  profile: StudentProfile
): Promise<SubjectPriority[]> {
  const ai = getAI();
  const context = `Ngành mục tiêu: ${selectedCareer}
Student Profile:
- Môn yêu thích: ${profile.favoriteSubjects.join(', ')}
- Môn không thích: ${profile.dislikedSubjects.join(', ')}
- Điểm mạnh: ${profile.strengths.join(', ')}
- Điểm yếu: ${profile.weaknesses.join(', ')}`;

  const response = await withGeminiRetry(() => ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: context,
    config: {
      systemInstruction: SUBJECT_PRIORITY_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: SUBJECTS_SCHEMA,
    },
  }));
  const parsed = JSON.parse(response.text || '{"subjects":[]}');
  return parsed.subjects as SubjectPriority[];
}

/**
 * Phân tích conversation thành StudyAvailability
 */
export async function extractAvailability(
  conversationText: string
): Promise<StudyAvailability> {
  const ai = getAI();
  const response = await withGeminiRetry(() => ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Đây là nội dung cuộc trò chuyện về thời gian biểu:\n\n${conversationText}`,
    config: {
      systemInstruction: 'Phân tích cuộc trò chuyện sau và trích xuất thông tin về thời gian biểu của học sinh. Chú ý quy ước ngày trong tuần (dayOfWeek): 1=Thứ 2, 2=Thứ 3, 3=Thứ 4, 4=Thứ 5, 5=Thứ 6, 6=Thứ 7, 7=Chủ nhật. Trả về JSON theo schema.',
      responseMimeType: 'application/json',
      responseSchema: AVAILABILITY_SCHEMA,
    },
  }));
  return JSON.parse(response.text || '{}') as StudyAvailability;
}

/**
 * Tạo lịch học tuần dựa trên availability + subject priorities
 */
export async function generateStudySchedule(
  selectedCareer: string,
  subjects: SubjectPriority[],
  availability: StudyAvailability
): Promise<ScheduleEntry[]> {
  const ai = getAI();
  const context = `Ngành mục tiêu: ${selectedCareer}

Môn học ưu tiên:
${subjects.map(s => `- ${s.name}: ${s.priority} priority, mục tiêu ${s.targetGrade} điểm`).join('\n')}

Thời gian biểu:
- Tổng giờ/tuần: ${availability.hoursPerWeek} giờ
- Ngày rảnh: ${availability.availableDays.map(d => {
    const days = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return days[d];
  }).join(', ')}
- Khung giờ:
${availability.timeSlots.map(ts => {
    const days = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return `  ${days[ts.dayOfWeek]}: ${ts.startTime} - ${ts.endTime}`;
  }).join('\n')}
- Thích học buổi: ${availability.preferredTime === 'morning' ? 'sáng' : availability.preferredTime === 'afternoon' ? 'chiều' : 'tối'}
- Ngày nghỉ: ${availability.restDays.map(d => {
    const days = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return days[d];
  }).join(', ') || 'Không có'}`;

  const response = await withGeminiRetry(() => ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: context,
    config: {
      systemInstruction: STUDY_PLAN_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: SCHEDULE_SCHEMA,
    },
  }));
  const parsed = JSON.parse(response.text || '{"weeklySchedule":[]}');
  return parsed.weeklySchedule as ScheduleEntry[];
}
