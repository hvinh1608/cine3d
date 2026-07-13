export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-8 px-4 py-10 md:px-8" aria-label="Đang tải nội dung">
      <div className="h-[45vh] rounded-3xl bg-white/5" />
      <div className="h-7 w-56 rounded bg-white/10" />
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="aspect-[2/3] rounded-2xl bg-white/5" />)}
      </div>
    </div>
  );
}
