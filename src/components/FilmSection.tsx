export default function FilmSection() {
  return (
    <section className="py-20 md:py-32 bg-[#fafafa]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <p className="text-xs tracking-[0.3em] text-muted mb-3">
            FILM
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            WITH SUACI
          </h2>
        </div>

        {/* Film Grid - 2 large + 1 vertical layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {/* Large Film Card 1 */}
          <div className="md:col-span-2 group cursor-pointer relative overflow-hidden">
            <div className="aspect-[16/9] bg-[#222] relative">
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Play Button */}
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/40 flex items-center justify-center group-hover:border-white/80 group-hover:scale-110 transition-all duration-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="ml-1"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {/* Text */}
              <div className="absolute bottom-0 left-0 p-6 md:p-8">
                <p className="text-[10px] tracking-[0.2em] text-white/50 mb-2">
                  EPISODE 01
                </p>
                <h3 className="text-lg md:text-xl font-semibold text-white">
                  The Beginning of SUACI
                </h3>
                <p className="text-xs text-white/50 mt-2">
                  브랜드의 시작, 그 첫 번째 이야기
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - 2 stacked */}
          <div className="flex flex-col gap-4 md:gap-5">
            {/* Film Card 2 */}
            <div className="group cursor-pointer relative overflow-hidden flex-1">
              <div className="aspect-[16/9] md:aspect-auto md:h-full bg-[#2a2a2a] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center group-hover:border-white/70 group-hover:scale-110 transition-all duration-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="ml-0.5"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <p className="text-[10px] tracking-[0.2em] text-white/50 mb-1">
                    EPISODE 02
                  </p>
                  <h3 className="text-sm font-semibold text-white">
                    Behind the Scenes
                  </h3>
                </div>
              </div>
            </div>

            {/* Film Card 3 */}
            <div className="group cursor-pointer relative overflow-hidden flex-1">
              <div className="aspect-[16/9] md:aspect-auto md:h-full bg-[#1e1e1e] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center group-hover:border-white/70 group-hover:scale-110 transition-all duration-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="ml-0.5"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <p className="text-[10px] tracking-[0.2em] text-white/50 mb-1">
                    LOOKBOOK
                  </p>
                  <h3 className="text-sm font-semibold text-white">
                    S/S Collection
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
