import type { AppLanguage } from '@/features/account/data/settings-storage';

const vi = {
  account: 'Tài khoản', settings: 'Cài đặt', language: 'Ngôn ngữ', dark: 'Tối',
  system: 'Theo hệ thống', autoplay: 'Tự động phát', dataSaver: 'Tiết kiệm dữ liệu',
  subtitles: 'Phụ đề', downloads: 'Tải xuống', notifications: 'Thông báo', privacy: 'Quyền riêng tư',
  save: 'Lưu', cancel: 'Hủy', retry: 'Thử lại', loading: 'Đang tải…', error: 'Đã xảy ra lỗi',
} as const;
const en: Record<keyof typeof vi, string> = {
  account: 'Account', settings: 'Settings', language: 'Language', dark: 'Dark',
  system: 'System', autoplay: 'Autoplay', dataSaver: 'Data saver', subtitles: 'Subtitles',
  downloads: 'Downloads', notifications: 'Notifications', privacy: 'Privacy',
  save: 'Save', cancel: 'Cancel', retry: 'Retry', loading: 'Loading…', error: 'Something went wrong',
};
export type TranslationKey = keyof typeof vi;
export function translate(language: AppLanguage, key: TranslationKey) {
  return (language === 'en' ? en : vi)[key];
}
