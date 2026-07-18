import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Điều khoản dịch vụ | CINE3D' };

export default function TermsPage() {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-slate-300"><h1 className="text-3xl font-black text-white">Điều khoản dịch vụ</h1><p className="mt-2 text-xs text-slate-500">Cập nhật ngày 18/07/2026</p><div className="mt-8 space-y-6 text-sm leading-7"><section><h2 className="text-lg font-bold text-white">Chấp nhận điều khoản</h2><p>Khi sử dụng CINE3D, bạn đồng ý cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và tuân thủ pháp luật hiện hành.</p></section><section><h2 className="text-lg font-bold text-white">Tài khoản</h2><p>Bạn chịu trách nhiệm cho hoạt động trên tài khoản của mình. CINE3D có thể tạm khóa tài khoản có dấu hiệu gian lận, lạm dụng hoặc gây ảnh hưởng đến hệ thống và người dùng khác.</p></section><section><h2 className="text-lg font-bold text-white">Dịch vụ</h2><p>Tính năng và nội dung có thể được cập nhật, gián đoạn hoặc thay đổi để bảo trì, bảo mật và nâng cao chất lượng. Không được khai thác dịch vụ để phát tán mã độc hoặc truy cập trái phép.</p></section><section><h2 className="text-lg font-bold text-white">Liên hệ</h2><p>Câu hỏi về điều khoản có thể gửi tới <a className="text-red-400" href="mailto:hvinh.job@gmail.com">hvinh.job@gmail.com</a>.</p></section></div></main>;
}
