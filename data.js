(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstraData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MISSION_END = "2042-06-18";
  const METRICS = [
    { id: "heartRate", label: "Heart rate", shortLabel: "Pulse", unit: "bpm", icon: "pulse", region: "heart", type: "line", description: "Resting pulse recorded in this fictional demo." },
    { id: "bloodPressure", label: "Blood pressure", shortLabel: "Pressure", unit: "mmHg", icon: "pressure", region: "heart", type: "paired", description: "Paired systolic and diastolic readings in this fictional demo." },
    { id: "temperature", label: "Temperature", shortLabel: "Temperature", unit: "°C", icon: "temperature", region: "body", type: "line", description: "Body temperature recorded in this fictional demo." },
    { id: "sleep", label: "Sleep", shortLabel: "Sleep", unit: "h", icon: "sleep", region: "brain", type: "bar", description: "Self-reported sleep duration; not a brain measurement." },
    { id: "mood", label: "Mood", shortLabel: "Mood", unit: "/ 5", icon: "mood", region: "brain", type: "mood", description: "Self-reported mood on a five-point scale; not a brain measurement." },
    { id: "activity", label: "Activity", shortLabel: "Activity", unit: "min", icon: "activity", region: "body", type: "bar", description: "Minutes of logged activity in a fictional day." }
  ];

  const PROFILES = [
    { id: "mira-chen", name: "Mira Chen", role: "Commander · Flight engineer", initials: "MC", color: "violet", health: "warning", activity: "active", note: "A slightly elevated pulse after scheduled exercise. Check-in is routine; the demo makes no medical assessment.", base: { heartRate: 82, systolic: 118, diastolic: 76, temperature: 36.8, sleep: 7.2, mood: 4, activity: 48 } },
    { id: "elias-okafor", name: "Elias Okafor", role: "Mission specialist · Geologist", initials: "EO", color: "teal", health: "stable", activity: "active", note: "Routine observations are steady across this simulated mission window.", base: { heartRate: 67, systolic: 112, diastolic: 72, temperature: 36.6, sleep: 7.8, mood: 4, activity: 56 } },
    { id: "sofia-alvarez", name: "Sofia Alvarez", role: "Pilot · Robotics lead", initials: "SA", color: "coral", health: "alert", activity: "active", note: "Simulated alert scenario for interface testing only. This is not a real reading or medical advice.", base: { heartRate: 104, systolic: 132, diastolic: 86, temperature: 37.2, sleep: 5.6, mood: 2, activity: 32 } },
    { id: "noah-williams", name: "Noah Williams", role: "Payload specialist · Biologist", initials: "NW", color: "blue", health: "stable", activity: "resting", note: "Rest period is scheduled. Resting activity is independent from the health-state label.", base: { heartRate: 61, systolic: 108, diastolic: 68, temperature: 36.5, sleep: 8.3, mood: 5, activity: 8 } }
  ];

  const SHAPES = {
    heartRate: [2, 1, 0, -1, 1, 3, 1, -2, -1, 0, 2, 1, -1, 0, 2, 1, -2, -1, 1, 2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 0],
    systolic: [2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 2, 1, 0, -2, 1, 3, 0, -1, 1, 2, -2, 0, 1, 2, -1, 0, 2, -1, 1, 0],
    temperature: [0.1, 0, -0.1, 0.2, 0, -0.1, 0.1, 0, -0.2, 0.1, 0, 0.1, -0.1, 0.2, 0, -0.1, 0, 0.1, -0.1, 0.2, 0, -0.2, 0.1, 0, 0.1, -0.1, 0, 0.2, -0.1, 0],
    sleep: [0.3, -0.4, 0.6, 0.1, -0.7, 0.4, 0.2, -0.3, 0.5, -0.2, 0.4, -0.5, 0.2, 0.3, -0.1, 0.6, -0.4, 0.1, -0.2, 0.5, -0.6, 0.3, 0.2, -0.1, 0.4, -0.3, 0.5, -0.4, 0.2, 0],
    mood: [0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0],
    activity: [8, -5, 12, -4, 3, 9, -8, 4, -3, 6, -6, 10, 2, -7, 5, 8, -4, 1, -9, 7, -2, 6, -5, 4, 10, -6, 2, -3, 5, 0]
  };

  function dayStamp(daysAgo) {
    const date = new Date(MISSION_END + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  function profile(id) {
    return PROFILES.find((item) => item.id === id) || PROFILES[0];
  }

  function valueFor(person, metric, index) {
    const base = person.base;
    const historyIndex = 29 - index;
    const wobble = metric === "bloodPressure" ? 0 : SHAPES[metric][historyIndex];
    switch (metric) {
      case "heartRate": return base.heartRate + wobble;
      case "bloodPressure": return { systolic: base.systolic + SHAPES.systolic[historyIndex], diastolic: base.diastolic + Math.round(SHAPES.systolic[historyIndex] * 0.6) };
      case "temperature": return Number((base.temperature + wobble).toFixed(1));
      case "sleep": return Number(Math.max(3.5, Math.min(10, base.sleep + wobble)).toFixed(1));
      case "mood": return Math.max(1, Math.min(5, base.mood + wobble));
      case "activity": return Math.max(0, base.activity + wobble);
      default: return null;
    }
  }

  function getSeries(profileId, metricId, days) {
    const person = profile(profileId);
    const metric = METRICS.find((item) => item.id === metricId);
    if (!metric) throw new Error("Unknown metric: " + metricId);
    const count = days === 7 ? 7 : 30;
    return Array.from({ length: count }, (_, index) => {
      const ago = count - index - 1;
      return { date: dayStamp(ago), value: valueFor(person, metricId, ago) };
    });
  }

  function latest(profileId, metricId) {
    return getSeries(profileId, metricId, 30).at(-1).value;
  }

  function formatValue(metricId, value) {
    if (metricId === "bloodPressure") return value.systolic + "/" + value.diastolic;
    if (metricId === "temperature") return Number(value).toFixed(1);
    if (metricId === "sleep") return Number(value).toFixed(1);
    return String(value);
  }

  return { MISSION_END, METRICS, PROFILES, getProfile: profile, getSeries, latest, formatValue };
});
