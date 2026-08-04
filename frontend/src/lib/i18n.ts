'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type Locale = 'vi' | 'en';

const STORAGE_KEY = 'cine3d-language';
const CHANGE_EVENT = 'cine3d-language-change';

const en = {
  home: 'Home', discover: 'Discover', allMovies: 'All movies', series: 'TV Series', movies: 'Movies',
  schedule: 'Schedule', watchTogether: 'Watch Together', search: 'Search', searchPlaceholder: 'Search movies...',
  downloadApp: 'Download CINE3D app', scanDownload: 'Scan to download CINE3D', scanHint: 'Use your Android camera to download the app.',
  downloadApk: 'Download Android APK', notifications: 'Notifications', noNotifications: 'No notifications yet.',
  account: 'Account', admin: 'Admin', feedback: 'Feedback & support', logout: 'Sign out', login: 'Sign In',
  upgradeVip: 'Upgrade to VIP', profile: 'Profile', recentSearches: 'Recent searches', clear: 'Clear',
  searchHint: 'Enter at least 2 characters to search', searchHintDetail: 'Movie title, original title, or related keyword',
  suggestions: 'Movie suggestions', keyboardSelect: 'Use ↑ ↓ to select', searching: 'Searching movies',
  noResults: 'No matching movies found', noResultsHint: 'Try a shorter title or check your spelling', allResults: 'View all results',
  updating: 'Updating', new: 'new',
} as const;

export type TranslationKey = keyof typeof en;

const vi: Record<TranslationKey, string> = {
  home: 'Trang Chủ', discover: 'Khám Phá', allMovies: 'Tất cả phim', series: 'Phim bộ', movies: 'Phim lẻ',
  schedule: 'Lịch chiếu', watchTogether: 'Xem Chung', search: 'Tìm kiếm', searchPlaceholder: 'Tìm nhanh tên phim...',
  downloadApp: 'Tải ứng dụng CINE3D', scanDownload: 'Quét mã để tải CINE3D', scanHint: 'Dùng camera điện thoại Android để tải ứng dụng.',
  downloadApk: 'Tải APK Android', notifications: 'Thông báo', noNotifications: 'Chưa có thông báo nào.',
  account: 'Tài khoản', admin: 'Quản trị', feedback: 'Góp ý & hỗ trợ', logout: 'Đăng xuất', login: 'Đăng Nhập',
  upgradeVip: 'Nâng cấp VIP', profile: 'Cá nhân', recentSearches: 'Tìm kiếm gần đây', clear: 'Xóa',
  searchHint: 'Nhập ít nhất 2 ký tự để tìm phim', searchHintDetail: 'Tên phim, tên gốc hoặc từ khóa liên quan',
  suggestions: 'Gợi ý phim', keyboardSelect: 'Dùng ↑ ↓ để chọn', searching: 'Đang tìm phim',
  noResults: 'Không tìm thấy phim phù hợp', noResultsHint: 'Thử tên ngắn hơn hoặc kiểm tra lại chính tả', allResults: 'Xem tất cả kết quả',
  updating: 'Đang cập nhật', new: 'mới',
};

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Locale {
  return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi';
}

export function useLanguage() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => 'vi' as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const t = (key: TranslationKey) => (locale === 'en' ? en[key] : vi[key]);
  return { locale, setLocale, t };
}
