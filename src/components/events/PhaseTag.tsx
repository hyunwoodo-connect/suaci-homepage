import { useTranslations } from "next-intl";
import type { EventPhase } from "@/types";

interface PhaseTagProps {
  phase: EventPhase;
}

export default function PhaseTag({ phase }: PhaseTagProps) {
  const t = useTranslations("events.phase");
  return (
    <span
      className={`inline-block w-fit rounded-full border px-[10px] py-[3px] text-[12px] ${
        phase === "live" ? "border-lime bg-lime text-ink" : "border-line text-grey"
      }`}
    >
      {t(phase)}
    </span>
  );
}
