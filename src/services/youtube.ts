/**
 * MyPath AI — YouTube Data API v3 Service
 *
 * Tìm kiếm video YouTube giáo dục theo môn học THPT.
 * Sử dụng REST API trực tiếp (không cần SDK).
 */

import type { YouTubeVideo, SubjectVideos, VideoRecommendations, SubjectPriority } from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3/search';

function getApiKey(): string {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('VITE_YOUTUBE_API_KEY chưa được cấu hình. Vui lòng thêm vào file .env.local');
  }
  return key;
}

/**
 * Tìm kiếm video YouTube theo query
 */
async function searchYouTubeVideos(
  query: string,
  maxResults = 2
): Promise<YouTubeVideo[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    relevanceLanguage: 'vi',
    regionCode: 'VN',
    videoCategoryId: '27', // Education
    maxResults: String(maxResults),
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message || response.statusText;
    throw new Error(`YouTube API error: ${message}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map((item: {
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { medium?: { url: string }; default?: { url: string } };
    };
  }) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

/**
 * Lấy video đề xuất cho tất cả môn học trong study plan
 */
export async function getVideoRecommendationsForSubjects(
  subjects: SubjectPriority[]
): Promise<VideoRecommendations> {
  // Search song song tất cả môn
  const results = await Promise.allSettled(
    subjects.map(async (subject): Promise<SubjectVideos> => {
      const query = `${subject.name} THPT bài giảng`;
      const videos = await searchYouTubeVideos(query);
      return { subject: subject.name, videos };
    })
  );

  const subjectVideos: SubjectVideos[] = results
    .filter((r): r is PromiseFulfilledResult<SubjectVideos> => r.status === 'fulfilled')
    .map(r => r.value);

  return {
    subjects: subjectVideos,
    generatedAt: Date.now(),
  };
}
