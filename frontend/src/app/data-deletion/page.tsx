import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Xóa dữ liệu người dùng | CINE3D' };

export default function DataDeletionPage() {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-slate-300"><h1 className="text-3xl font-black text-white">Yêu cầu xóa dữ liệu người dùng</h1><div className="mt-8 space-y-6 text-sm leading-7"><p>Bạn có thể xóa quyền CINE3D trong phần Cài đặt → Ứng dụng và trang web của Facebook. Để yêu cầu xóa toàn bộ tài khoản và dữ liệu liên quan tại CINE3D, hãy làm theo các bước sau:</p><ol className="list-decimal space-y-2 pl-5"><li>Gửi email từ địa chỉ đang dùng cho tài khoản CINE3D tới <a className="text-red-400" href="mailto:hvinh.job@gmail.com?subject=Yêu cầu xóa dữ liệu CINE3D">hvinh.job@gmail.com</a>.</li><li>Tiêu đề ghi “Yêu cầu xóa dữ liệu CINE3D”.</li><li>Ghi rõ email tài khoản và phương thức đăng nhập Facebook/Google/email.</li></ol><p>Chúng tôi sẽ xác minh quyền sở hữu và xử lý yêu cầu trong vòng 30 ngày. Dữ liệu phải lưu giữ theo nghĩa vụ pháp lý hoặc phòng chống gian lận có thể được giữ trong thời hạn cần thiết.</p></div></main>;
}
