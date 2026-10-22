import { useTranslations } from "next-intl";
import type { EventPhase } from "@/types";

interface PhaseTagProps {
  phase: EventPhase;
}

export default function PhaseTag({ phase }: PhaseTagProps) {
  const t = useTranslations("events.phase");
  return (
    <span
      className={`inline-block rounded-full border px-[10px] py-[3px] text-[11px] ${
        phase === "live" ? "border-lime text-lime" : "border-line text-grey"
      }`}
    >
      {t(phase)}
    </span>
  );
}
