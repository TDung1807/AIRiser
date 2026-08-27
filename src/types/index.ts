// User types
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  currentPhase: ChatPhase;
}

// Chat types
export type ChatPhase = 'interview' | 'profile_review' | 'career_recommendation' | 'availability' | 'study_plan' | 'complete';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'profile_card' | 'career_card' | 'schedule_card' | 'export_actions' | 'error';
}

// Student Profile types
export interface StudentProfile {
  interests: string[];
  strengths: string[];
  weaknesses: string[];
  favoriteSubjects: string[];
  dislikedSubjects: string[];
  learningStyle: string;
  goals: string[];
  careerInterests: string[];
  personality: string;
  completedAt: number | null;
}

// Career Recommendation types
export interface CareerRecommendation {
  name: string;
  nameVi: string;
  matchPercentage: number;
  whyItFits: string;
  relevantStrengths: string[];
  relevantInterests: string[];
  requiredSkills: string[];
  areasToImprove: string[];
}

export interface CareerRecommendations {
  careers: CareerRecommendation[];
  selectedCareer: string | null;
  generatedAt: number;
}

// Subject Priority types
export type PriorityLevel = 'high' | 'medium' | 'low';

export interface SubjectPriority {
  name: string;
  priority: PriorityLevel;
  targetGrade: number;
  reason: string;
  currentProgress: number;
}

// Study Availability types
export interface StudyAvailability {
  hoursPerWeek: number;
  availableDays: number[]; // 1=Monday...7=Sunday
  timeSlots: TimeSlot[];
  preferredTime: 'morning' | 'afternoon' | 'evening';
  restDays: number[];
}

export interface TimeSlot {
  dayOfWeek: number;
  startTime: string; // "19:00"
  endTime: string;   // "20:00"
}

// Study Plan types
export interface ScheduleEntry {
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  subject: string;
  focusArea: string;
  priority: PriorityLevel;
}

export interface StudyPlan {
  targetCareer: string;
  subjects: SubjectPriority[];
  availability: StudyAvailability;
  weeklySchedule: ScheduleEntry[];
  calendarEventIds: string[];
  sheetId: string | null;
  sheetUrl: string | null;
  generatedAt: number;
}

// Chat History
export interface ChatHistory {
  messages: ChatMessage[];
  phase: ChatPhase;
  lastMessageAt: number;
}

// YouTube Video Recommendation types
export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
}

export interface SubjectVideos {
  subject: string;
  videos: YouTubeVideo[];
}

export interface VideoRecommendations {
  subjects: SubjectVideos[];
  generatedAt: number;
}
