interface ShutterProps {
  /** ready: 누를 수 있음 / starting: 카메라 켜는 중(비활성) */
  state: "ready" | "starting";
  onPress?: () => void;
}

/** 80px 셔터(글자 없음). 찍는 동안엔 화면이 셔터 대신 카운트다운을 둔다. */
export default function Shutter({ state, onPress }: ShutterProps) {
  const isReady = state === "ready";
  return (
    <button
      type="button"
      aria-label={isReady ? "찍기 시작" : "카메라 켜는 중"}
      disabled={!isReady}
      onClick={onPress}
      className={`box-border block size-[80px] shrink-0 rounded-full border-4 border-solid border-(color:--tf-cream) p-0 ${
        isReady
          ? "cursor-pointer bg-(--tf-ink) shadow-[0_0_0_3px_var(--tf-ink)]"
          : "bg-(--tf-idle) shadow-[0_0_0_3px_var(--tf-idle)]"
      }`}
    />
  );
}
