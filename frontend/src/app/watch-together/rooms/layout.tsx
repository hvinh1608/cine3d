import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phòng xem chung | CINE3D',
  description: 'Danh sách phòng xem phim cùng bạn bè dành cho thành viên CINE3D.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function WatchTogetherRoomsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
