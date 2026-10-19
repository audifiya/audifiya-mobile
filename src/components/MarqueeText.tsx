import { decodeEntities } from "@/lib/utils";

export function MarqueeText({
  text,
  className = "",
  threshold = 15,
}: {
  text: string;
  className?: string;
  threshold?: number;
}) {
  const clean = decodeEntities(text);
  const long = clean.length > threshold;
  return (
    <div className={`w-full overflow-hidden ${className}`} title={clean}>
      {long ? (
        <span className="animate-marquee pr-8" children={clean} />
      ) : (
        <span className="block truncate" children={clean} />
      )}
    </div>
  );
}
