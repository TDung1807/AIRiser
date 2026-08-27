import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, CalendarDays, Clock, FileSpreadsheet, LayoutDashboard, Play, RefreshCw, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { StudentProfile, StudyPlan, VideoRecommendations } from '../types';
import { getStudentProfile, getStudyPlan, saveStudyPlan, resetUserData, getVideoRecommendations, saveVideoRecommendations } from '../services/firestore';
import { createAcademicTracker } from '../services/googleSheets';
import { createStudyScheduleOnCalendar } from '../services/googleCalendar';
import { getVideoRecommendationsForSubjects } from '../services/youtube';

const priorityLabel = (priority: string) => priority === 'high' ? '🔴 Cao' : priority === 'medium' ? '🟠 Trung bình' : '🟡 Thấp';

export default function DashboardPage() {
  const { user, getGoogleWorkspaceAccessToken } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [videoRecs, setVideoRecs] = useState<VideoRecommendations | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    Promise.all([getStudentProfile(user.uid), getStudyPlan(user.uid)])
      .then(([savedProfile, savedPlan]) => { setProfile(savedProfile); setPlan(savedPlan); })
      .catch((error) => console.warn('Không thể tải dashboard:', error))
      .finally(() => setLoading(false));
  }, [user]);

  // Auto-load video recommendations khi có study plan
  useEffect(() => {
    if (!user || !plan || loading) return;
    let cancelled = false;

    const loadVideos = async () => {
      setVideosLoading(true);
      setVideosError(null);
      try {
        // Check cache trước
        const cached = await getVideoRecommendations(user.uid);
        if (cached && !cancelled) {
          setVideoRecs(cached);
          setVideosLoading(false);
          return;
        }
        // Cache miss hoặc hết hạn → gọi YouTube API
        const recs = await getVideoRecommendationsForSubjects(plan.subjects);
        if (!cancelled) {
          setVideoRecs(recs);
          await saveVideoRecommendations(user.uid, recs);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Không thể tải video đề xuất:', error);
          setVideosError('Không thể tải video đề xuất. Kiểm tra YouTube API Key.');
        }
      } finally {
        if (!cancelled) setVideosLoading(false);
      }
    };

    loadVideos();
    return () => { cancelled = true; };
  }, [user, plan, loading]);

  const refreshVideos = async () => {
    if (!user || !plan || videosLoading) return;
    setVideosLoading(true);
    setVideosError(null);
    try {
      const recs = await getVideoRecommendationsForSubjects(plan.subjects);
      setVideoRecs(recs);
      await saveVideoRecommendations(user.uid, recs);
    } catch (error) {
      console.warn('Không thể tải lại video:', error);
      setVideosError('Không thể tải video đề xuất. Kiểm tra YouTube API Key.');
    } finally {
      setVideosLoading(false);
    }
  };

  const exportPlan = async (target: 'calendar' | 'sheets') => {
    if (!plan || !user || isExporting) return;
    setIsExporting(true);
    try {
      const token = await getGoogleWorkspaceAccessToken();
      if (target === 'calendar') {
        const ids = await createStudyScheduleOnCalendar(token, plan.weeklySchedule, plan.targetCareer);
        const updated = { ...plan, calendarEventIds: ids }; 
        setPlan(updated); 
        await saveStudyPlan(user.uid, updated);
        alert(`Đã thêm ${ids.length} buổi học lặp lại vào Google Calendar của bạn! ✅`);
      } else {
        const sheet = await createAcademicTracker(token, user.displayName, plan.targetCareer, plan.subjects);
        const updated = { ...plan, sheetId: sheet.spreadsheetId, sheetUrl: sheet.spreadsheetUrl }; 
        setPlan(updated); 
        await saveStudyPlan(user.uid, updated);
        alert(`Đã tạo Academic Tracker. Bạn có thể mở tại Google Sheets. ✅`);
      }
    } catch (error) { 
      console.error(error); 
      alert('Không thể xuất kế hoạch. Hãy cấp quyền Google Calendar và Google Sheets rồi thử lại.'); 
    }
    finally { setIsExporting(false); }
  };

  const executeReset = async () => {
    if (!user) return;
    setIsResetting(true);
    setShowResetConfirm(false);
    try {
      await resetUserData(user.uid);
      navigate('/chat');
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi xóa dữ liệu.');
      setIsResetting(false);
    }
  };

  const stats = [
    { label: 'Trạng thái', value: plan ? 'Đã có kế hoạch' : profile ? 'Đã có hồ sơ' : 'Đang phỏng vấn', icon: Target, className: 'border-blue-100 bg-blue-50', iconClassName: 'bg-blue-500' },
    { label: 'Ngành mục tiêu', value: plan?.targetCareer || 'Chưa chọn', icon: Target, className: 'border-purple-100 bg-purple-50', iconClassName: 'bg-purple-500' },
    { label: 'Môn học ưu tiên', value: `${plan?.subjects.length || 0} môn`, icon: BookOpen, className: 'border-green-100 bg-green-50', iconClassName: 'bg-green-500' },
    { label: 'Giờ học/tuần', value: `${plan?.availability.hoursPerWeek || 0} giờ`, icon: Clock, className: 'border-orange-100 bg-orange-50', iconClassName: 'bg-orange-500' },
  ];

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu của bạn…</div>;

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-8"><h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900"><LayoutDashboard className="h-8 w-8 text-blue-600" />Bảng điều khiển</h1><p className="mt-2 text-gray-600">Chào mừng trở lại, {user?.displayName || 'bạn'}!</p></div>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">{stats.map(({ label, value, icon: Icon, className, iconClassName }) => <div key={label} className={`rounded-xl border p-5 ${className}`}><div className="flex items-center gap-3"><div className={`rounded-lg p-2 text-white ${iconClassName}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-gray-500">{label}</p><p className="font-semibold text-gray-900">{value}</p></div></div></div>)}</div>
    <div className="mt-8 grid gap-8 lg:grid-cols-3">
      <section className="rounded-2xl border bg-white p-6 lg:col-span-2"><h2 className="mb-5 text-xl font-bold">Hồ sơ của bạn</h2>{profile ? <div className="grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold">Sở thích & điểm mạnh</h3><p className="mt-2 text-sm text-gray-600">{[...profile.interests, ...profile.strengths].join(' · ')}</p></div><div><h3 className="font-semibold">Mục tiêu</h3><p className="mt-2 text-sm text-gray-600">{profile.goals.join(' · ')}</p></div><div className="md:col-span-2"><h3 className="font-semibold">Phong cách học</h3><p className="mt-2 text-sm text-gray-600">{profile.learningStyle}</p></div></div> : <EmptyState text="Hoàn thành phỏng vấn AI để xem hồ sơ cá nhân." />}</section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-5 text-xl font-bold">Hành động nhanh</h2>
        <div className="space-y-3">
          <Link to="/chat" className="block rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white">{plan ? 'Xem kế hoạch' : 'Tiếp tục cùng AI'}</Link>
          
          {plan && !plan.sheetUrl && (
            <button onClick={() => exportPlan('sheets')} disabled={isExporting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              <FileSpreadsheet className="h-5 w-5" /> Thêm vào Google Sheets
            </button>
          )}
          {plan?.sheetUrl && (
            <a href={plan.sheetUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-semibold text-green-700 hover:bg-green-100">
              <FileSpreadsheet className="h-5 w-5" /> Mở Google Sheets
            </a>
          )}

          {plan && (!plan.calendarEventIds || plan.calendarEventIds.length === 0) && (
            <button onClick={() => exportPlan('calendar')} disabled={isExporting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
              <CalendarDays className="h-5 w-5" /> Thêm vào Google Calendar
            </button>
          )}
          {plan?.calendarEventIds && plan.calendarEventIds.length > 0 && (
            <p className="rounded-xl bg-blue-50 p-3 text-center text-sm font-semibold text-blue-700">✓ Đã đồng bộ Calendar</p>
          )}
        </div>
      </section>
    </div>
    {plan && <><section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><BookOpen className="h-5 w-5 text-blue-600" />Môn học ưu tiên</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{plan.subjects.map((subject) => <div key={subject.name} className="rounded-xl bg-gray-50 p-4"><div className="flex justify-between gap-2"><strong>{subject.name}</strong><span className="text-sm">{priorityLabel(subject.priority)}</span></div><p className="mt-2 text-sm text-gray-600">Mục tiêu: {subject.targetGrade} · {subject.reason}</p></div>)}</div></section>
    <section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><Calendar className="h-5 w-5 text-blue-600" />Lịch học hằng tuần</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{plan.weeklySchedule.map((entry, index) => <div key={`${entry.dayOfWeek}-${index}`} className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4"><strong>{entry.dayName}, {entry.startTime}–{entry.endTime}</strong><p className="mt-1 font-medium text-blue-900">{entry.subject}</p></div>)}</div><div className="mt-6 text-center text-sm italic text-gray-500">💡: Sử dụng tính năng thêm vào Google Calendar để có nội dung học chi tiết cho từng môn nhé !</div></section>

    {/* Video đề xuất */}
    <section className="mt-8 rounded-2xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Play className="h-5 w-5 text-red-500" />Video đề xuất
        </h2>
        <button
          onClick={refreshVideos}
          disabled={videosLoading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${videosLoading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </div>

      {videosLoading && !videoRecs && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-gray-100 p-4">
              <div className="mb-3 h-32 rounded-lg bg-gray-200" />
              <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {videosError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm text-red-600">
          {videosError}
        </div>
      )}

      {videoRecs && videoRecs.subjects.length > 0 && (
        <div className="space-y-6">
          {videoRecs.subjects.map((sv) => (
            <div key={sv.subject}>
              <h3 className="mb-3 font-semibold text-gray-800">{sv.subject}</h3>
              {sv.videos.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sv.videos.map((video) => (
                    <a
                      key={video.videoId}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex gap-3 rounded-xl border bg-gray-50 p-3 transition-colors hover:border-red-200 hover:bg-red-50"
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-20 w-36 flex-shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-red-700">
                          {video.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {video.channelTitle}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Không tìm thấy video cho môn này.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {videoRecs && videoRecs.subjects.length === 0 && !videosLoading && (
        <p className="text-center text-sm text-gray-500">Không có video đề xuất.</p>
      )}
    </section>
    </>}
    {!plan && <section className="mt-8"><EmptyState text="Chưa có kế hoạch học tập. Hãy tiếp tục cuộc trò chuyện để MyPath AI tạo lịch phù hợp cho bạn." /></section>}
    
    <div className="mt-12 flex justify-center">
      <button 
        onClick={() => setShowResetConfirm(true)}
        disabled={isResetting}
        className="rounded-xl border border-red-200 bg-white px-6 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isResetting ? 'Đang xóa...' : 'Tạo lại từ đầu'}
      </button>
    </div>

    {showResetConfirm && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Xác nhận tạo lại</h3>
          <p className="mb-6 text-gray-600">Bạn có chắc chắn muốn xóa toàn bộ dữ liệu và làm lại từ đầu không? Hành động này không thể hoàn tác.</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              onClick={executeReset}
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              Xác Nhận
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-center text-gray-500"><p>{text}</p><Link to="/chat" className="mt-4 inline-block font-semibold text-blue-600">Bắt đầu với MyPath AI →</Link></div>; }
