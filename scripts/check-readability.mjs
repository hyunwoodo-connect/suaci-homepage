// 읽기 규칙 검사(게이트·저장 훅이 같이 부른다). 사람이 위에서 아래로 읽게 하는 두 가지를 본다.
//   1. 중첩 호출: 함수 인자에는 이름 붙은 값만 넣는다. 호출·삼항·계산식은 먼저 `const` 로 이름을 붙인다.
//   2. export 설명: export 하는 함수·상수·타입 바로 위에 `/** */` 가 있다.
// 줄 단위 근사라 콜백(`=>` 가 있는 줄)은 1에서 뺀다. 테스트와 테스트 도구(`testing/`)는 보지 않는다.
// 사용: `node scripts/check-readability.mjs` (전체) · `node scripts/check-readability.mjs <파일>` (그 파일만, 훅)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ---- 레포마다 고치는 곳 ----
/** 검사할 폴더와 확장자 */
const ROOTS = ["src"];
const EXTENSIONS = /\.(ts|tsx)$/;
/** 보지 않는 파일: 테스트·테스트 도구(`src/test/` 는 Vitest 준비 파일) */
const SKIP_FILE = /\.test\.tsx?$|\/testing\/|\.d\.ts$|^src\/test\//;
/** export 설명을 보지 않는 파일(예: 파일 머리 주석이 그 역할을 하는 핸들러) */
const SKIP_EXPORT_DOC_FILE = /^$/;
/** Next.js 가 이름을 정한 export(라우트 설정·메타데이터·미들웨어 `config`·라우트 핸들러). 설명을 요구하지 않는다 */
const FRAMEWORK_EXPORT =
  /^(metadata|generateMetadata|generateStaticParams|generateViewport|viewport|revalidate|dynamic|dynamicParams|fetchCache|runtime|preferredRegion|maxDuration|config|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
/** 중첩 검사에서 빼는 줄 */
const NESTING_EXEMPT = [
  /=>/,
  // 함수 선언 줄의 괄호는 호출이 아니라 매개변수 목록이다(`now: number = Date.now()` 같은 기본값)
  /^\s*(export )?(default )?(async )?function /,
];
// ---- 여기까지 ----

const COMMENT_OR_IMPORT = /^\s*(\/\/|\*|\/\*\*?|import |export \{|export type \{|export \* )/;

// 문자열·정규식 안의 괄호가 세는 데 끼지 않게 내용을 비운다
const stripLiterals = (line) =>
  line.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

// 호출 `x(` 의 인자 안(깊이 1 이상)에 또 호출·삼항 ` ? `·계산 ` + - * / % ` 이 있으면 위반
const isNested = (code) => {
  const stack = [];
  for (let k = 0; k < code.length; k += 1) {
    const c = code[k];
    if (c === "(") {
      const before = code.slice(0, k);
      // `if (`·`return (` 처럼 키워드 뒤 괄호는 호출이 아니다
      const isCall =
        /[\w$\]]\s*$/.test(before) &&
        !/\b(if|for|while|switch|return|typeof|await|catch|in|of|new|readonly|keyof)\s*$/.test(
          before,
        );
      if (isCall && stack.includes("call")) return true;
      stack.push(isCall ? "call" : "group");
    } else if (c === ")") stack.pop();
    else if (stack.includes("call")) {
      const rest = code.slice(k, k + 3);
      if (/^ \? /.test(rest)) return true;
      if (/^ [+\-*/%] /.test(rest)) return true;
    }
  }
  return false;
};

// 여러 줄 템플릿 문자열 안의 줄은 코드가 아니라 글이다(백틱 수로 따라간다)
const backticks = (line) => (line.replace(/\\./g, "").match(/`/g) ?? []).length;

const EXPORT_DECL =
  /^export (const|let|function|async function|type|interface|class|enum) ([A-Za-z_$][\w$]*)/;

function problemsOf(file) {
  const found = [];
  const lines = readFileSync(file, "utf8").split("\n");
  let inTemplate = false;
  lines.forEach((line, i) => {
    const skip =
      inTemplate || COMMENT_OR_IMPORT.test(line) || NESTING_EXEMPT.some((re) => re.test(line));
    if (!skip && isNested(stripLiterals(line))) {
      found.push(`${file}:${i + 1}: 중첩 호출 — ${line.trim().slice(0, 110)}`);
    }
    if (backticks(line) % 2 === 1) inTemplate = !inTemplate;
  });
  if (!SKIP_EXPORT_DOC_FILE.test(file)) {
    lines.forEach((line, i) => {
      const m = EXPORT_DECL.exec(line);
      if (!m || FRAMEWORK_EXPORT.test(m[2])) return;
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === "") j -= 1;
      if (!/\*\/\s*$/.test(lines[j] ?? ""))
        found.push(`${file}:${i + 1}: export \`${m[2]}\` 위에 /** */ 설명이 없다`);
    });
  }
  return found;
}

const only = process.argv[2];
// 새 파일도 첫 커밋 전에 보도록 추적 + 무시 안 된 미추적 파일
const files = only
  ? [only]
  : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...ROOTS], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((f) => EXTENSIONS.test(f) && !SKIP_FILE.test(f));
const targets = files.filter((f) => EXTENSIONS.test(f) && !SKIP_FILE.test(f));
const problems = targets.flatMap(problemsOf);

if (problems.length > 0) {
  process.stderr.write(
    `읽기 규칙 위반 ${problems.length}건 — 인자에는 이름 붙은 값만(호출·삼항·계산식은 먼저 const 로), export 에는 /** */:\n${problems.map((p) => `  ${p}`).join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(`✔ 읽기 규칙 통과 (${targets.length}개 파일)\n`);
