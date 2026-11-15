import { cn } from "@/shared/lib/cn";
import { AIRLOCK, FAR_POINT, SUN_DIRECTION, pathPoint, walkerPlace } from "../lib/surface";
import { stormIntensity } from "../lib/timeline";

/** Top-down view of the same ground as the 3D scene: +x to the right, +z down. */
const VIEW_BOX = "-66 -12 90 56";

const PATH = Array.from({ length: 81 }, (_, step) => {
  const [x, z] = pathPoint(step / 80);
  return `${step === 0 ? "M" : "L"}${x.toFixed(1)} ${z.toFixed(1)}`;
}).join("");

interface StormDiagramProps {
  progress: number;
  /** Labels for the two people on the surface. */
  names: readonly [string, string];
  className?: string;
}

/**
 * Plan of the habitat, the refuge and the walk, with the two walkers and a dust tint that follows the storm.
 * It is the fallback when WebGL is unavailable or slow, and the placeholder while the 3D scene loads.
 */
export function StormDiagram({ progress, names, className }: StormDiagramProps) {
  const intensity = stormIntensity(progress);
  const walkers = [walkerPlace(0, progress), walkerPlace(1, progress)];
  const sunX = SUN_DIRECTION[0];
  const sunZ = SUN_DIRECTION[2];
  const sunLength = Math.hypot(sunX, sunZ);
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Plan of the habitat, the refuge and the walk back to the airlock on the day of the solar storm"
      data-storm-diagram=""
      className={cn("block h-full w-full", className)}
    >
      <rect x={-66} y={-12} width={90} height={56} className="fill-space-mars/20" />
      <path d={PATH} className="fill-none stroke-space-signal" strokeWidth={0.5} strokeDasharray="1.6 1.4" />
      <circle cx={FAR_POINT[0]} cy={FAR_POINT[1]} r={1.3} className="fill-none stroke-console-muted" strokeWidth={0.4} />
      <rect x={-3} y={-9} width={6} height={18} rx={3} className="fill-console-muted stroke-console-text" strokeWidth={0.4} />
      <rect x={AIRLOCK[0]} y={-1.2} width={2.4} height={2.4} rx={0.6} className="fill-space-sun stroke-console-text" strokeWidth={0.3} />
      <ellipse cx={6} cy={11.5} rx={5.9} ry={4.2} className="fill-space-mars/60 stroke-console-text/60" strokeWidth={0.3} />
      {walkers.map((walker, index) =>
        walker.inside ? null : (
          <g key={index} data-walker={index}>
            <circle cx={walker.x} cy={walker.z} r={1.1} className={index === 0 ? "fill-space-sun-glow" : "fill-space-signal"} />
            <text x={walker.x} y={walker.z - 2} textAnchor="middle" fontSize={2.6} className="fill-console-text font-semibold">
              {names[index]}
            </text>
          </g>
        ),
      )}
      <g aria-hidden="true" fontSize={2.6} className="fill-console-text font-semibold">
        <text x={0} y={-10.6} textAnchor="middle">
          Habitat
        </text>
        <text x={6} y={18} textAnchor="middle">
          Refuge
        </text>
      </g>
      <g transform="translate(12 -6)">
        <line x1={0} y1={0} x2={(sunX / sunLength) * 7} y2={(sunZ / sunLength) * 7} className="stroke-space-sun" strokeWidth={0.6} />
        <circle cx={(sunX / sunLength) * 7} cy={(sunZ / sunLength) * 7} r={1.4} className="fill-space-sun" />
      </g>
      <rect x={-66} y={-12} width={90} height={56} className="fill-space-mars" opacity={0.5 * intensity} />
    </svg>
  );
}
