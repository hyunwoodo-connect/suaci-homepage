import ReactMarkdown from "react-markdown";

interface LegalMarkdownProps {
  /** 관리 툴에서 쓴 마크다운 본문 */
  source: string;
}

/**
 * 정책 문서 본문. 원시 HTML은 건너뛴다(관리 툴 입력이 그대로 홈페이지에 그려지므로).
 * 글은 읽기 폭(72자)에 묶고, 절 제목·번호 목록만 쓰는 문서라 요소 스타일은 여기서 전부 준다.
 */
export default function LegalMarkdown({ source }: LegalMarkdownProps) {
  return (
    <article lang="ko" className="legal-doc max-w-[72ch] text-[14px] leading-[1.8] text-ink-soft">
      {/* 페이지 제목이 이미 h1이라 본문의 # 는 h2로 내린다 */}
      <ReactMarkdown skipHtml components={{ h1: "h2" }}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
