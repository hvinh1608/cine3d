'use client';

import { useEffect } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <CircleAlert className="h-12 w-12 text-red-500" />
      <h2 className="text-2xl font-black">Không thể hiển thị nội dung</h2>
      <p className="max-w-md text-sm text-slate-400">Đã có lỗi tạm thời. Bạn có thể thử tải lại khu vực này.</p>
      <button type="button" onClick={reset} className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold hover:bg-red-500">
        <RotateCcw className="h-4 w-4" /> Thử lại
      </button>
    </div>
  );
}
