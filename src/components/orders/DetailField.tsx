interface DetailFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}

/** 신청 사유 상세(선택) — 폰에서 확대되지 않게 글자 16px */
export default function DetailField({ id, label, placeholder, value, onChange }: DetailFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-[6px] block text-[13px] text-grey">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-y border border-line bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors placeholder:text-grey/50 focus:border-ink"
      />
    </div>
  );
}
