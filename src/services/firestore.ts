/**
 * MyPath AI — Firestore Service
 * 
 * Quản lý dữ liệu người dùng trên Cloud Firestore
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  UserProfile,
  StudentProfile,
  CareerRecommendations,
  StudyPlan,
  ChatHistory,
  ChatPhase,
  ChatMessage,
  VideoRecommendations,
} from '@/types';

// ============================================================
// USER PROFILE
// ============================================================

/**
 * Lấy thông tin user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

/**
 * Cập nhật phase hiện tại của user
 */
export async function updateUserPhase(userId: string, phase: ChatPhase): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, { currentPhase: phase });
}

// ============================================================
// STUDENT PROFILE
// ============================================================

/**
 * Lưu Student Profile
 */
export async function saveStudentProfile(
  userId: string,
  profile: StudentProfile
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'data', 'profile');
  await setDoc(docRef, profile, { merge: true });
}

/**
 * Lấy Student Profile
 */
export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  const docRef = doc(db, 'users', userId, 'data', 'profile');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as StudentProfile;
  }
  return null;
}

// ============================================================
// CAREER RECOMMENDATIONS
// ============================================================

/**
 * Lưu Career Recommendations
 */
export async function saveCareerRecommendations(
  userId: string,
  recommendations: CareerRecommendations
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'data', 'recommendations');
  await setDoc(docRef, recommendations, { merge: true });
}

/**
 * Lấy Career Recommendations
 */
export async function getCareerRecommendations(
  userId: string
): Promise<CareerRecommendations | null> {
  const docRef = doc(db, 'users', userId, 'data', 'recommendations');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as CareerRecommendations;
  }
  return null;
}

// ============================================================
// STUDY PLAN
// ============================================================

/**
 * Lưu Study Plan
 */
export async function saveStudyPlan(
  userId: string,
  plan: StudyPlan
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'data', 'studyPlan');
  await setDoc(docRef, plan, { merge: true });
}

/**
 * Lấy Study Plan
 */
export async function getStudyPlan(userId: string): Promise<StudyPlan | null> {
  const docRef = doc(db, 'users', userId, 'data', 'studyPlan');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as StudyPlan;
  }
  return null;
}

// ============================================================
// CHAT HISTORY
// ============================================================

/**
 * Lưu Chat History
 */
export async function saveChatHistory(
  userId: string,
  history: ChatHistory
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'data', 'chatHistory');
  await setDoc(docRef, {
    messages: history.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      type: m.type || 'text',
    })),
    phase: history.phase,
    lastMessageAt: history.lastMessageAt,
  }, { merge: true });
}

/**
 * Lấy Chat History
 */
export async function getChatHistory(userId: string): Promise<ChatHistory | null> {
  const docRef = doc(db, 'users', userId, 'data', 'chatHistory');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as ChatHistory;
  }
  return null;
}

/**
 * Thêm messages vào chat history
 */
export async function appendChatMessages(
  userId: string,
  newMessages: ChatMessage[],
  phase: ChatPhase
): Promise<void> {
  const existing = await getChatHistory(userId);
  const messages = existing ? [...existing.messages, ...newMessages] : newMessages;
  
  await saveChatHistory(userId, {
    messages,
    phase,
    lastMessageAt: Date.now(),
  });
}

/**
 * Xóa toàn bộ dữ liệu của user để làm lại từ đầu
 */
export async function resetUserData(userId: string): Promise<void> {
  const collections = ['profile', 'recommendations', 'studyPlan', 'chatHistory', 'videoRecommendations'];
  await Promise.all(collections.map(col => deleteDoc(doc(db, 'users', userId, 'data', col))));
  await updateUserPhase(userId, 'interview');
}

// ============================================================
// VIDEO RECOMMENDATIONS CACHE
// ============================================================

const VIDEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Lưu Video Recommendations (cache)
 */
export async function saveVideoRecommendations(
  userId: string,
  recommendations: VideoRecommendations
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'data', 'videoRecommendations');
  await setDoc(docRef, recommendations, { merge: true });
}

/**
 * Lấy Video Recommendations từ cache. Return null nếu hết hạn (> 24h).
 */
export async function getVideoRecommendations(
  userId: string
): Promise<VideoRecommendations | null> {
  const docRef = doc(db, 'users', userId, 'data', 'videoRecommendations');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const data = docSnap.data() as VideoRecommendations;
  if (Date.now() - data.generatedAt > VIDEO_CACHE_TTL_MS) {
    return null; // Cache expired
  }
  return data;
}
