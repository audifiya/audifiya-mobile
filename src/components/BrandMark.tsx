export function BrandMark({
  size = "md",
  tagline = false,
  align = "left",
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  align?: "left" | "center";
}) {
  const textSize =
    size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-lg";
  const tagSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <div className={`${textSize} font-bold leading-none tracking-tight`}>
        <span>Audi</span>
        <span className="brand-gradient-text">Fiya</span>
      </div>
      {tagline && (
        <div
          className={`brand-tagline mt-1 ${tagSize} leading-none tracking-wider`}
        >
          where melody meets the heart
        </div>
      )}
    </div>
  );
}
