/** 찰칵 순간의 흰 빛. ScallopFrame 창 안에 두면 타원으로 잘린다. */
export default function Flash() {
  return <div aria-hidden="true" className="absolute inset-0 bg-white opacity-85" />;
}
