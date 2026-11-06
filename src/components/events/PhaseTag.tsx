import { useTranslations } from "next-intl";

import Badge, { type BadgeTone } from "@/components/ui/Badge";
import type { EventPhase } from "@/types";

interface PhaseTagProps {
  phase: EventPhase;
}

/** 진행 중인 이벤트만 '열려 있다'(done — 라임 옅은 바탕), 곧 열릴 것은 무채색, 끝난 것은 회색 */
const PHASE_TONE = {
  upcoming: "neutral",
  live: "done",
  ended: "muted",
} as const satisfies Record<EventPhase, BadgeTone>;

export default function PhaseTag({ phase }: PhaseTagProps) {
  const t = useTranslations("events.phase");
  return <Badge tone={PHASE_TONE[phase]}>{t(phase)}</Badge>;
}
