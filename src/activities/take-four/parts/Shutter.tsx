interface ShutterProps {
  /** ready: 찰칵 / starting: 카메라 켜는 중(비활성) / running: 자동으로 넘어가는 중(비활성) */
  state: "ready" | "starting" | "running";
  onPress?: () => void;
}

const SHUTTER = {
  ready: { text: "찰칵", label: "찰칵 — 찍기 시작" },
  starting: { text: "…", label: "카메라 켜는 중" },
  running: { text: "자동", label: "자동 — 다음 장으로 넘어가요" },
} as const;

/** 84px 셔터. 누를 수 있는 건 ready뿐이다. 이름은 보이는 글자로 시작한다(…는 글자가 아니라 뺐다). */
export default function Shutter({ state, onPress }: ShutterProps) {
  const { text, label } = SHUTTER[state];
  const isWarming = state === "starting";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={state !== "ready"}
      onClick={onPress}
      className={`box-border flex size-[84px] shrink-0 items-center justify-center rounded-full border-[5px] border-solid [font-family:inherit] font-bold text-(color:--tf-cream) ${
        isWarming
          ? "border-(color:--tf-warming) bg-(--tf-muted)"
          : "border-(color:--tf-red) bg-(--tf-ink) shadow-[0_0_0_3px_var(--tf-ink)]"
      } ${state === "running" ? "text-[15px]" : "text-[17px]"} ${state === "ready" ? "cursor-pointer" : ""}`}
    >
      {text}
    </button>
  );
}
