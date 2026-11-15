import { cn } from "@/shared/lib/cn";
import { SOLAR_EXCLUSION_DEG, nearConjunction, type MissionGeometry, type Vec3 } from "../lib/geometry";
import { TRAJECTORY_LEGS, type TrajectoryLeg } from "../lib/trajectory";

/** SVG units per astronomical unit; the view covers ±1.9 AU around the Sun. */
const SCALE = 100;
const EXTENT = 190;
const EXCLUSION_REACH_AU = 3.4;
/** Half-width of the illustrative storm fan, in radians, and how far past the crew it reaches (SVG units). */
const STORM_HALF_ANGLE = 0.15;
const STORM_OVERSHOOT = 30;

const LEG_STROKE: Readonly<Record<TrajectoryLeg["id"], string>> = {
  out: "stroke-chart-primary",
  surface: "stroke-chart-secondary",
  return: "stroke-chart-bar",
};

function point(position: Vec3): [number, number] {
  // Seen from the ecliptic north pole: +x to the right, +y up (SVG y grows downward).
  return [position[0] * SCALE, -position[1] * SCALE];
}

function pathFor(track: readonly (Vec3 | null)[], fromDay: number, toDay: number, close = false): string {
  const commands: string[] = [];
  for (let day = Math.max(1, fromDay); day <= Math.min(toDay, track.length); day += 1) {
    const position = track[day - 1];
    if (!position) continue;
    const [x, y] = point(position);
    commands.push(`${commands.length ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return commands.length > 1 ? commands.join("") + (close ? "Z" : "") : "";
}

/** Thin wedge from Earth through the Sun: inside it, the Sun blocks the radio link. */
function exclusionWedge(earth: Vec3): string {
  const [ex, ey] = point(earth);
  const distance = Math.hypot(ex, ey);
  if (distance === 0) return "";
  const heading = Math.atan2(-ey, -ex);
  const half = (SOLAR_EXCLUSION_DEG * Math.PI) / 180;
  const reach = EXCLUSION_REACH_AU * SCALE;
  const edge = (angle: number) => `${(ex + Math.cos(angle) * reach).toFixed(1)} ${(ey + Math.sin(angle) * reach).toFixed(1)}`;
  return `M${ex.toFixed(1)} ${ey.toFixed(1)}L${edge(heading - half)}L${edge(heading + half)}Z`;
}

/** Fan from the Sun past the crew: the particle stream of a solar-storm scenario day (illustrative). */
function stormFan(ship: Vec3): string {
  const [sx, sy] = point(ship);
  const reach = Math.hypot(sx, sy) + STORM_OVERSHOOT;
  const heading = Math.atan2(sy, sx);
  const edge = (angle: number) => `${(Math.cos(angle) * reach).toFixed(1)} ${(Math.sin(angle) * reach).toFixed(1)}`;
  return `M0 0L${edge(heading - STORM_HALF_ANGLE)}L${edge(heading + STORM_HALF_ANGLE)}Z`;
}

interface OrbitDiagramProps {
  geometry: MissionGeometry;
  day: number;
  /** True on a solar-storm scenario day. */
  storm?: boolean;
  className?: string;
}

/**
 * Top-down 2D diagram of the same geometry as the 3D scene. It is the fallback when WebGL is
 * unavailable or slow, and the placeholder while the 3D scene loads.
 */
export function OrbitDiagram({ geometry, day, storm = false, className }: OrbitDiagramProps) {
  const earth = geometry.earth[day - 1];
  const mars = geometry.mars[day - 1];
  const ship = geometry.ship[day - 1];
  const comm = geometry.comm[day - 1];
  const onMars = (geometry.distMarsMkm[day - 1] ?? 1) < 0.5;
  const atEarth = (geometry.distEarthMkm[day - 1] ?? 1) < 0.5;
  const exclusionShown = nearConjunction(geometry, day);
  const earthPoint = earth ? point(earth) : null;
  const marsPoint = mars ? point(mars) : null;
  const shipPoint = ship ? point(ship) : null;

  return (
    <svg
      viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Top-down diagram of the Sun, Earth, Mars and the spacecraft on the selected mission day"
      data-orbit-diagram=""
      className={cn("block h-full w-full", className)}
    >
      <path d={pathFor(geometry.earth, 1, 367, true)} className="fill-none stroke-space-orbit" strokeWidth={0.8} />
      <path d={pathFor(geometry.mars, 1, 688, true)} className="fill-none stroke-space-orbit" strokeWidth={0.8} />
      {ship && storm ? <path d={stormFan(ship)} data-storm-fan="" className="fill-space-sun/15" /> : null}
      {earth && exclusionShown ? <path d={exclusionWedge(earth)} data-exclusion="" className="fill-space-sun-glow/30 stroke-space-sun-glow/60" strokeWidth={0.4} /> : null}
      {TRAJECTORY_LEGS.map((leg) => {
        const [fromDay, toDay] = leg.days(geometry);
        return (
          <g key={leg.id} data-leg={leg.id} className={cn("fill-none", LEG_STROKE[leg.id])}>
            <path d={pathFor(geometry.ship, fromDay, toDay)} strokeWidth={1.2} strokeOpacity={0.3} />
            {day > fromDay ? <path d={pathFor(geometry.ship, fromDay, Math.min(day, toDay))} strokeWidth={2.4} strokeLinecap="round" /> : null}
          </g>
        );
      })}
      {earthPoint && shipPoint && !atEarth ? (
        <line
          x1={shipPoint[0]}
          y1={shipPoint[1]}
          x2={earthPoint[0]}
          y2={earthPoint[1]}
          data-link={comm}
          className={comm === "blackout" ? "stroke-status-unknown-border" : "stroke-space-signal"}
          strokeWidth={1.4}
          strokeDasharray={comm === "blackout" ? "3 4" : undefined}
        />
      ) : null}
      <circle r={9} className="fill-space-sun-glow/30" />
      <circle r={5.5} className="fill-space-sun" />
      {marsPoint ? <circle cx={marsPoint[0]} cy={marsPoint[1]} r={3.6} className="fill-space-mars" /> : null}
      {earthPoint ? <circle cx={earthPoint[0]} cy={earthPoint[1]} r={4.2} className="fill-space-earth" /> : null}
      {shipPoint ? <circle cx={shipPoint[0]} cy={shipPoint[1]} r={7} className="fill-none stroke-console-text" strokeWidth={1.2} /> : null}
      <g className="fill-console-text text-2xs font-semibold" aria-hidden="true">
        <text x={9} y={-9}>
          Sun
        </text>
        {earthPoint ? (
          <text x={earthPoint[0] + 10} y={earthPoint[1] + 3}>
            {atEarth ? "Earth · crew" : "Earth"}
          </text>
        ) : null}
        {marsPoint ? (
          <text x={marsPoint[0] + 10} y={marsPoint[1] + 3}>
            {onMars ? "Mars · crew" : "Mars"}
          </text>
        ) : null}
        {shipPoint && !onMars && !atEarth ? (
          <text x={shipPoint[0] + 10} y={shipPoint[1] + 3}>
            Crew
          </text>
        ) : null}
      </g>
    </svg>
  );
}
