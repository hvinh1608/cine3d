import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Xóa dữ liệu người dùng | CINE3D' };

export default function DataDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-slate-300">
      <h1 className="text-3xl font-black text-white">Xóa tài khoản và dữ liệu người dùng</h1>
      <div className="mt-8 space-y-6 text-sm leading-7">
        <p>
          Người dùng đã đăng nhập trên ứng dụng Android CINE3D có thể tự xóa tài khoản trong
          {' '}<strong className="text-white">Tài khoản → Pháp lý → Yêu cầu xóa dữ liệu</strong>.
          API xác nhận bằng cụm từ <code className="text-amber-300">DELETE_MY_ACCOUNT</code>
          {' '}(và mật khẩu đối với tài khoản email/password).
        </p>
        <p>Nếu bạn không còn truy cập ứng dụng, hãy làm theo các bước sau:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Gửi email từ địa chỉ đang dùng cho tài khoản CINE3D tới{' '}
            <a className="text-red-400" href="mailto:hvinh.job@gmail.com?subject=Yêu cầu xóa dữ liệu CINE3D">
              hvinh.job@gmail.com
            </a>.
          </li>
          <li>Tiêu đề ghi “Yêu cầu xóa dữ liệu CINE3D”.</li>
          <li>Ghi rõ email tài khoản và phương thức đăng nhập Facebook/Google/email.</li>
        </ol>
        <p>
          Chúng tôi sẽ xác minh quyền sở hữu và xử lý yêu cầu trong vòng 30 ngày. Dữ liệu phải lưu giữ
          theo nghĩa vụ pháp lý hoặc phòng chống gian lận có thể được giữ trong thời hạn cần thiết.
          Bạn cũng có thể thu hồi quyền CINE3D trong phần Cài đặt → Ứng dụng và trang web của Facebook/Google.
        </p>
        <p>
          <Link href="/account" className="text-red-400 hover:text-red-300">Đăng nhập tài khoản</Link>
          {' · '}
          <Link href="/privacy" className="text-red-400 hover:text-red-300">Chính sách quyền riêng tư</Link>
        </p>
      </div>
    </main>
  );
}
