interface SectionEyebrowProps {
  number: string;
  label: string;
}

export default function SectionEyebrow({ number, label }: SectionEyebrowProps) {
  return (
    <div className="font-en text-[11px] tracking-[0.22em] uppercase text-green flex gap-[10px] items-baseline">
      <span className="num text-ink-mute tracking-[0.18em]">{number}</span>
      <span className="inline-block w-[18px] h-px bg-green -translate-y-[3px]" />
      <span>{label}</span>
    </div>
  );
}
