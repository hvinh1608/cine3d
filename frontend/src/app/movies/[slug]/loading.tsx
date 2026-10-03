export default function MovieDetailLoading() {
  return (
    <div className="min-h-[70vh] bg-[#171820]">
      <div className="relative h-[440px] animate-pulse bg-[#20222d] md:h-[520px]" />
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 md:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-12">
        <div className="mx-auto aspect-[2/3] w-44 animate-pulse rounded-lg bg-[#252735] lg:w-full" />
        <div className="space-y-4">
          <div className="h-12 w-48 animate-pulse rounded-full bg-[#252735]" />
          <div className="h-8 w-full max-w-xl animate-pulse rounded bg-[#252735]" />
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-md bg-[#252735]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
