interface PlayButtonProps {
  /** 버튼 크기: "sm" = 48px, "lg" = 80px */
  size?: "sm" | "lg";
}

const SIZES = {
  sm: { button: "w-12 h-12", icon: 16 },
  lg: { button: "w-16 h-16 md:w-20 md:h-20", icon: 24 },
} as const;

/**
 * 영상 재생 버튼
 * - 호버 시 테두리 밝아지며 살짝 확대
 */
export default function PlayButton({ size = "sm" }: PlayButtonProps) {
  const { button, icon } = SIZES[size];

  return (
    <div
      className={`${button} rounded-full border-2 border-white/30 flex items-center justify-center group-hover:border-white/80 group-hover:scale-110 transition-all duration-500`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="white"
        className="ml-0.5"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  );
}
