import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Góp ý & hỗ trợ | CINE3D',
  description: 'Gửi góp ý, yêu cầu phim và yêu cầu hỗ trợ tới đội ngũ CINE3D.',
  robots: { index: false, follow: false },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
