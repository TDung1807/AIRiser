import React, { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Bot, BookOpen, CalendarDays, CheckCircle2, Clock, FileSpreadsheet, MessageSquare, RefreshCw, Send, Target, User, UserCircle, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { CareerRecommendation, ChatMessage, ChatPhase, ScheduleEntry, StudentProfile, SubjectPriority, StudyAvailability, StudyPlan } from '../types';
import { getCareerRecommendations, getChatHistory, getStudyPlan, getStudentProfile, saveCareerRecommendations, saveChatHistory, saveStudentProfile, saveStudyPlan, updateUserPhase } from '../services/firestore';
import { createAcademicTracker } from '../services/googleSheets';
import { createStudyScheduleOnCalendar } from '../services/googleCalendar';

const PHASES: Array<{ id: ChatPhase; label: string; icon: typeof MessageSquare }> = [
  { id: 'interview', label: 'Phỏng vấn', icon: MessageSquare },
  { id: 'profile_review', label: 'Hồ sơ cá nhân', icon: UserCircle },
  { id: 'career_recommendation', label: 'Đề xuất ngành', icon: Target },
  { id: 'availability', label: 'Thời gian biểu', icon: Clock },
  { id: 'study_plan', label: 'Kế hoạch học tập', icon: BookOpen },
];
const WELCOME_MESSAGE = 'Xin chào! 👋 Mình là MyPath AI. Bạn có thể giới thiệu một chút về bản thân, những điều bạn thích làm và lĩnh vực bạn đang quan tâm không?';
const phases = PHASES.map((phase) => phase.id);
const phaseIndex = (phase: ChatPhase) => phases.indexOf(phase);
const toConversation = (messages: ChatMessage[]) => messages.map((message) => `${message.role === 'user' ? 'Học sinh' : 'MyPath AI'}: ${message.content}`).join('\n\n');

export default function ChatPage() {
  const { user, getGoogleWorkspaceAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: WELCOME_MESSAGE, timestamp: Date.now() }]);
  const [currentPhase, setCurrentPhase] = useState<ChatPhase>('interview');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [careers, setCareers] = useState<CareerRecommendation[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectPriority[]>([]);
  const [availabilityMessages, setAvailabilityMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const availabilityChatRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addMessage = (content: string, type: ChatMessage['type'] = 'text') => {
    const message = { id: crypto.randomUUID(), role: 'assistant' as const, content, timestamp: Date.now(), type };
    setMessages((current) => [...current, message]);
  };
  const setPhase = async (phase: ChatPhase) => {
    setCurrentPhase(phase);
    if (user) await updateUserPhase(user.uid, phase).catch(console.warn);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => {
    if (!isLoading && currentPhase !== 'career_recommendation' && currentPhase !== 'study_plan' && currentPhase !== 'complete') {
      textareaRef.current?.focus();
    }
  }, [isLoading, currentPhase]);
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([getChatHistory(user.uid), getStudentProfile(user.uid), getCareerRecommendations(user.uid), getStudyPlan(user.uid)]).then(([history, savedProfile, savedRecommendations, savedPlan]) => {
      if (!mounted) return;
      if (history?.messages.length) setMessages(history.messages);
      if (savedPlan) setCurrentPhase('complete'); else if (history?.phase) setCurrentPhase(history.phase);
      setProfile(savedProfile); setCareers(savedRecommendations?.careers || []);
      setSelectedCareer(savedRecommendations?.selectedCareer || savedPlan?.targetCareer || null);
      setSubjects(savedPlan?.subjects || []); setPlan(savedPlan);
    }).catch((error) => console.warn('Không thể khôi phục dữ liệu:', error));
    return () => { mounted = false; };
  }, [user]);
  useEffect(() => {
    if (!user || !messages.length) return;
    const timer = window.setTimeout(() => saveChatHistory(user.uid, { messages, phase: currentPhase, lastMessageAt: Date.now() }).catch(console.warn), 600);
    return () => window.clearTimeout(timer);
  }, [messages, currentPhase, user]);

  const finishInterview = async (allMessages: ChatMessage[]) => {
    if (!user) return;
    const { analyzeProfile, recommendCareers } = await import('../services/gemini');
    const result = await analyzeProfile(toConversation(allMessages));
    const recommendations = await recommendCareers(result);
    setProfile(result); setCareers(recommendations);
    await Promise.all([saveStudentProfile(user.uid, result), saveCareerRecommendations(user.uid, { careers: recommendations, selectedCareer: null, generatedAt: Date.now() })]);
    await setPhase('career_recommendation');
    addMessage('Mình đã tổng hợp hồ sơ và tìm được các ngành phù hợp. Hãy chọn một ngành bạn muốn hướng tới nhé! 🎯', 'career_card');
  };
  const selectCareer = async (career: CareerRecommendation) => {
    // Once a choice is made, keep it immutable for this recommendation session.
    if (!profile || !user || isLoading || selectedCareer) return;
    setIsLoading(true);
    try {
      setSelectedCareer(career.nameVi);
      const { identifySubjectPriorities, createAvailabilityChat } = await import('../services/gemini');
      const priorities = await identifySubjectPriorities(career.nameVi, profile);
      setSubjects(priorities);
      await saveCareerRecommendations(user.uid, { careers, selectedCareer: career.nameVi, generatedAt: Date.now() });
      availabilityChatRef.current = createAvailabilityChat(career.nameVi, priorities);
      await setPhase('availability');
      addMessage(`Bạn đã chọn **${career.nameVi}**. Các môn cần ưu tiên đã sẵn sàng.\n\nBạn có thể tự học khoảng bao nhiêu giờ mỗi tuần?`, 'schedule_card');
    } catch (error) {
      console.error('Không thể tạo môn ưu tiên:', error);
      const { getGeminiErrorMessage } = await import('../services/gemini');
      addMessage(getGeminiErrorMessage(error));
    }
    finally { setIsLoading(false); }
  };
  const finishAvailability = async (allAvailabilityMessages: ChatMessage[]) => {
    if (!selectedCareer || !user) return;
    const { extractAvailability, generateStudySchedule } = await import('../services/gemini');
    const availability: StudyAvailability = await extractAvailability(toConversation(allAvailabilityMessages));
    const schedule = await generateStudySchedule(selectedCareer, subjects, availability);
    const newPlan: StudyPlan = { targetCareer: selectedCareer, subjects, availability, weeklySchedule: schedule, calendarEventIds: [], sheetId: null, sheetUrl: null, generatedAt: Date.now() };
    setPlan(newPlan); await saveStudyPlan(user.uid, newPlan); await setPhase('complete');
    addMessage('Kế hoạch học tập cá nhân hóa đã sẵn sàng. 📅\n\nHãy nhấn nút bên dưới để chuyển sang Bảng điều khiển và xem lộ trình học tập chi tiết nhé.', 'export_actions');
  };
  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault(); const text = inputValue.trim();
    if (!text || isLoading || currentPhase === 'career_recommendation' || currentPhase === 'study_plan' || currentPhase === 'complete') return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    const nextMessages = [...messages, userMessage]; setMessages(nextMessages); setInputValue(''); setIsLoading(true);
    try {
      const { createInterviewChat, sendInterviewMessage } = await import('../services/gemini');
      if (currentPhase === 'interview') {
        // The welcome prompt is question 1. The seventh answer is still sent to
        // Gemini so it can use that information in its final interview response.
        const interviewAnswerCount = nextMessages.filter((message) => message.role === 'user').length;
        if (!chatSessionRef.current) {
          const historyData = messages
            .filter(m => (!m.type || m.type === 'text') && !m.content.includes('Hệ thống AI') && !m.content.includes('Máy chủ AI') && !m.content.includes('Kết nối Internet') && !m.content.includes('Gemini'))
            .reduce((acc, m) => {
               const role = m.role === 'assistant' ? 'model' : 'user';
               if (acc.length === 0 || acc[acc.length - 1].role !== role) {
                 acc.push({ role, parts: [{ text: m.content }] });
               } else {
                 acc[acc.length - 1].parts[0].text += '\n\n' + m.content;
               }
               return acc;
            }, [] as any[]);
          chatSessionRef.current = createInterviewChat(historyData);
        }
        let response = await sendInterviewMessage(chatSessionRef.current, text);
        const complete = response.includes('[INTERVIEW_COMPLETE]') || interviewAnswerCount >= 7;
        response = response.replace('[INTERVIEW_COMPLETE]', '').trim();
        if (interviewAnswerCount >= 7) {
          response = 'Cảm ơn bạn đã chia sẻ! Mình đã có đủ thông tin để bắt đầu tạo lộ trình học tập cá nhân hóa cho bạn nhé! 🎯';
        } else if (!response) {
          response = complete ? 'Tuyệt vời! Đợi mình một chút để tổng hợp thông tin nhé...' : '';
        }
        if (!response) throw new Error('empty_response');
        const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: response, timestamp: Date.now() };
        const allMessages = [...nextMessages, assistantMessage]; setMessages(allMessages);
        if (complete) await finishInterview(allMessages);
      } else if (currentPhase === 'availability') {
        if (!availabilityChatRef.current && selectedCareer) {
          const { createAvailabilityChat } = await import('../services/gemini'); availabilityChatRef.current = createAvailabilityChat(selectedCareer, subjects);
        }
        let response = await sendInterviewMessage(availabilityChatRef.current, text);
        const complete = response.includes('[AVAILABILITY_COMPLETE]');
        response = response.replace('[AVAILABILITY_COMPLETE]', '').trim();
        if (!response) {
          response = complete ? 'Tuyệt vời! Mình đã nắm được lịch của bạn rồi. Để mình xây dựng kế hoạch học tập nhé! 📅' : '';
        }
        if (!response) throw new Error('empty_response');
        const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: response, timestamp: Date.now() };
        const allMessages = [...availabilityMessages, userMessage, assistantMessage]; setAvailabilityMessages(allMessages);
        setMessages((current) => [...current, assistantMessage]); if (complete) await finishAvailability(allMessages);
      }
    } catch (error) {
      console.error('Lỗi Gemini trong chat:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      // Chỉ hủy session khi lỗi nghiêm trọng (auth/API key) — giữ session cho lỗi tạm thời
      const isFatal = /API_KEY|401|403|PERMISSION_DENIED/i.test(errorMessage);
      if (isFatal) {
        chatSessionRef.current = null;
        availabilityChatRef.current = null;
      }
      const { getGeminiErrorMessage } = await import('../services/gemini');
      setInputValue(text);
      setMessages((current) => {
        const reverted = current.filter(m => m.id !== userMessage.id);
        return [...reverted, { id: crypto.randomUUID(), role: 'assistant', content: getGeminiErrorMessage(error), timestamp: Date.now(), type: 'error' }];
      });
    }
    finally { setIsLoading(false); }
  };
  const exportPlan = async (target: 'calendar' | 'sheets') => {
    if (!plan || !user || isExporting) return;
    setIsExporting(true);
    try {
      const token = await getGoogleWorkspaceAccessToken();
      if (target === 'calendar') {
        const ids = await createStudyScheduleOnCalendar(token, plan.weeklySchedule, plan.targetCareer);
        const updated = { ...plan, calendarEventIds: ids }; setPlan(updated); await saveStudyPlan(user.uid, updated);
        addMessage(`Đã thêm ${ids.length} buổi học lặp lại vào Google Calendar của bạn! ✅`);
      } else {
        const sheet = await createAcademicTracker(token, user.displayName, plan.targetCareer, plan.subjects);
        const updated = { ...plan, sheetId: sheet.spreadsheetId, sheetUrl: sheet.spreadsheetUrl }; setPlan(updated); await saveStudyPlan(user.uid, updated);
        addMessage(`Đã tạo Academic Tracker. Bạn có thể mở tại [Google Sheets](${sheet.spreadsheetUrl}). ✅`);
      }
    } catch (error) { console.error(error); addMessage('Không thể xuất kế hoạch. Hãy cấp quyền Google Calendar và Google Sheets rồi thử lại.'); }
    finally { setIsExporting(false); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendMessage(); } };

  return <div className="flex h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
    <aside className="hidden w-80 shrink-0 border-r border-gray-200 bg-white lg:block overflow-y-auto"><div className="p-6"><h2 className="mb-6 text-xl font-bold">Tiến trình của bạn</h2><nav className="space-y-5">{PHASES.map((phase, index) => { const Icon = phase.icon; const current = currentPhase === phase.id; const past = currentPhase === 'complete' || phaseIndex(currentPhase) > index; return <div key={phase.id} className={`flex items-center gap-3 ${current ? 'text-blue-600' : past ? 'text-green-600' : 'text-gray-400'}`}><div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${current ? 'border-blue-600' : past ? 'border-green-500' : 'border-gray-200'}`}>{past ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div><span className="font-medium">{phase.label}</span></div>; })}</nav></div></aside>
    <main className="flex min-w-0 flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">{messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
      {message.role === 'assistant' && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100"><Bot className="h-5 w-5 text-blue-600" /></div>}
      <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm md:max-w-[72%] md:text-base ${message.role === 'user' ? 'bg-blue-600 text-white' : 'border border-gray-100 bg-white text-gray-800'}`}><div className="chat-markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        {message.type === 'career_card' && <div className="mt-4 space-y-3">{careers.map((career) => {
          const isSelected = selectedCareer === career.nameVi;
          const isCareerLocked = isLoading || Boolean(selectedCareer);
          return <button key={career.name} disabled={isCareerLocked} onClick={() => selectCareer(career)} className={`block w-full rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}><div className="flex justify-between gap-3"><strong>{career.nameVi}{isSelected && ' · Đã chọn'}</strong><span className="font-bold text-blue-700">{career.matchPercentage}%</span></div><p className="mt-1 text-sm text-gray-600">{career.whyItFits}</p></button>;
        })}</div>}
        {message.type === 'schedule_card' && subjects.length > 0 && <div className="mt-4 grid gap-2">{subjects.map((subject) => <div key={subject.name} className="rounded-lg bg-gray-50 p-2 text-sm"><strong>{subject.name}</strong> · {subject.priority === 'high' ? '🔴 Cao' : subject.priority === 'medium' ? '🟠 Trung bình' : '🟡 Thấp'} · mục tiêu {subject.targetGrade}</div>)}</div>}
        {message.type === 'export_actions' && plan && <div className="mt-4 space-y-3"><div className="space-y-2">{plan.weeklySchedule.map((entry: ScheduleEntry, index) => <div key={`${entry.dayOfWeek}-${index}`} className="rounded-lg bg-gray-50 p-2 text-sm"><strong>{entry.dayName} {entry.startTime}–{entry.endTime}</strong>: {entry.subject}</div>)}</div><div className="flex flex-wrap gap-2"><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Chuyển sang Bảng điều khiển <ArrowRight className="h-4 w-4" /></Link></div></div>}
        {message.type === 'error' && <button onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"><RefreshCw className="h-3.5 w-3.5" /> Gửi lại</button>}
      </div>{message.role === 'user' && <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">{user?.photoURL ? <img className="h-full w-full object-cover" src={user.photoURL} alt="Bạn" /> : <User className="h-5 w-5" />}</div>}
    </div>)}{isLoading && <div className="flex gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100"><Bot className="h-5 w-5 text-blue-600" /></div><div className="rounded-2xl bg-white px-5 py-3 shadow-sm">MyPath AI đang suy nghĩ…</div></div>}<div ref={bottomRef} /></div>
    <div className="border-t bg-white p-4"><form onSubmit={handleSendMessage} className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border bg-gray-50 p-2"><textarea ref={textareaRef} value={inputValue} onChange={(event) => setInputValue(event.target.value)} onKeyDown={onKeyDown} disabled={isLoading || currentPhase === 'career_recommendation' || currentPhase === 'study_plan' || currentPhase === 'complete'} placeholder={currentPhase === 'career_recommendation' ? 'Hãy chọn một ngành ở trên' : (currentPhase === 'study_plan' || currentPhase === 'complete') ? 'Kế hoạch đã sẵn sàng, vui lòng vào bảng điều khiển' : 'Nhập tin nhắn...'} className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2 outline-none disabled:opacity-50" rows={1}/><button type="submit" disabled={!inputValue.trim() || isLoading || currentPhase === 'career_recommendation' || currentPhase === 'study_plan' || currentPhase === 'complete'} className="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button></form></div>
  </main></div>;
}
