import type { ReactNode } from "react";

import { FRAME_SCALLOP } from "../paths";

/** 타원 창 크기(촬영 안내선이 이 상자에 맞춰 자리를 잡는다) */
export const FRAME_WINDOW = { width: 240, height: 314 } as const;

interface ScallopFrameProps {
  /** 시안 aria-label(`카메라 화면`, `카메라 화면: 무표정`) */
  label: string;
  /** 타원 창 안(비디오·사진·카운트다운·플래시). 창 밖은 잘린다 */
  children?: ReactNode;
}

/**
 * 촬영 액자 300×400. 빨간 물결 테두리 + 타원 창 + 위 리본.
 * 창: viewBox(0 -10 300 400)의 타원 cx150 cy190 rx120 ry157 → 화면 좌표 left30 top43 240×314.
 */
export default function ScallopFrame({ label, children }: ScallopFrameProps) {
  return (
    <div className="relative h-[400px] w-[300px] shrink-0">
      <svg
        width="300"
        height="400"
        viewBox={FRAME_SCALLOP.viewBox}
        role="img"
        aria-label={label}
        className="absolute inset-0 overflow-visible"
      >
        <path
          d={FRAME_SCALLOP.d}
          fill="var(--tf-cream)"
          stroke="var(--tf-red)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute top-[43px] left-[30px] h-[314px] w-[240px] overflow-hidden rounded-[50%] bg-(--tf-camera)">
        {children}
      </div>
      <Ribbon />
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Ribbon() {
  return (
    <svg
      width="300"
      height="400"
      viewBox={FRAME_SCALLOP.viewBox}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      <g transform="translate(150 6)">
        <path
          d="M0 0c-14-14-34-16-38-6s14 16 38 6zM0 0c14-14 34-16 38-6s-14 16-38 6z"
          fill="var(--tf-red)"
          stroke="var(--tf-ink)"
          strokeWidth="1.5"
        />
        <path
          d="M-3 2l-10 24M3 2l10 24"
          stroke="var(--tf-red)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle r="6" fill="var(--tf-red)" stroke="var(--tf-ink)" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
