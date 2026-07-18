export default function Loading() {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#020205]/90 backdrop-blur-sm" role="status" aria-label="Đang tải nội dung">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border border-red-500/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-red-500 border-r-purple-500" />
          <span className="absolute inset-[9px] rounded-full bg-red-500/10 shadow-[0_0_22px_rgba(239,68,68,0.35)]" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">CINE3D</span>
      </div>
    </div>
  );
}
