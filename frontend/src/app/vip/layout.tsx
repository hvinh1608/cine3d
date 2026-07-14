import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nâng cấp VIP | CINE3D',
  description: 'Chọn gói CINE3D Premium và quản lý thời hạn thành viên VIP.',
};

export default function VipLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
