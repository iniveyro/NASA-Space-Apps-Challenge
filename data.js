(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstraData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MISSION_END = "2042-06-18";
  const METRICS = [
    { id: "heartRate", label: "Heart rate", unit: "bpm", region: "heart", type: "line", description: "Fictional daily resting-pulse reading." },
    { id: "bloodPressure", label: "Blood pressure", unit: "mmHg", region: "heart", type: "paired", description: "Fictional paired systolic and diastolic point readings." },
    { id: "temperature", label: "Temperature", unit: "°C", region: "body", type: "line", description: "Fictional daily body-temperature reading." },
    { id: "sleep", label: "Sleep", unit: "h", region: "brain", type: "bar", description: "Self-reported sleep duration; not a brain measurement." },
    { id: "mood", label: "Mood", unit: "/ 5", region: "brain", type: "category", description: "Self-reported mood on a five-point scale." },
    { id: "activity", label: "Activity", unit: "min", region: "body", type: "bar", description: "Fictional minutes of logged daily activity." },
    { id: "spo2", label: "SpO₂", unit: "%", region: "body", type: "line", description: "Simulated point reading; not a continuous sensor stream." },
    { id: "glucose", label: "Glucose", unit: "mg/dL", region: "body", type: "line", description: "Simulated point reading; not a continuous sensor stream." },
    { id: "stress", label: "Stress", unit: "/ 5", region: "brain", type: "category", description: "Self-reported stress on a five-point scale; not a brain measurement." },
    { id: "radiation", label: "Cumulative radiation", unit: "mGy", region: "body", type: "line", description: "Fictional cumulative mission dose; values are nondecreasing and are not a dose rate." }
  ];

  const PROFILES = [
    { id: "mira-chen", name: "Mira Chen", role: "Commander · Flight engineer", initials: "MC", color: "blue", health: "monitoring", activity: "active", age: 38, weightKg: 64, sex: "Female", boneNote: "Spaceflight can affect bone health. Individual responses vary; this demo does not estimate bone density or loss.", base: { heartRate: 82, systolic: 118, diastolic: 76, temperature: 36.8, sleep: 7.2, mood: 4, activity: 48, spo2: 98, glucose: 94, stress: 2, radiation: 14.2 } },
    { id: "elias-okafor", name: "Elias Okafor", role: "Mission specialist · Geologist", initials: "EO", color: "green", health: "stable", activity: "active", age: 42, weightKg: 79, sex: "Male", boneNote: "Spaceflight can affect bone health. Individual responses vary; this demo does not estimate bone density or loss.", base: { heartRate: 67, systolic: 112, diastolic: 72, temperature: 36.6, sleep: 7.8, mood: 4, activity: 56, spo2: 97, glucose: 101, stress: 2, radiation: 12.6 } },
    { id: "sofia-alvarez", name: "Sofia Alvarez", role: "Pilot · Robotics lead", initials: "SA", color: "orange", health: "simulated-alert", activity: "active", age: 35, weightKg: 58, sex: "Female", boneNote: "Spaceflight can affect bone health. Individual responses vary; this demo does not estimate bone density or loss.", base: { heartRate: 104, systolic: 132, diastolic: 86, temperature: 37.2, sleep: 5.6, mood: 2, activity: 32, spo2: 96, glucose: 108, stress: 4, radiation: 16.8 } },
    { id: "noah-williams", name: "Noah Williams", role: "Payload specialist · Biologist", initials: "NW", color: "slate", health: "stable", activity: "resting", age: 31, weightKg: 73, sex: "Male", boneNote: "Spaceflight can affect bone health. Individual responses vary; this demo does not estimate bone density or loss.", base: { heartRate: 61, systolic: 108, diastolic: 68, temperature: 36.5, sleep: 8.3, mood: 5, activity: 8, spo2: 99, glucose: 89, stress: 1, radiation: 11.4 } }
  ];

  const SHAPES = {
    heartRate: [2, 1, 0, -1, 1, 3, 1, -2, -1, 0, 2, 1, -1, 0, 2, 1, -2, -1, 1, 2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 0],
    systolic: [2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 2, 1, 0, -2, 1, 3, 0, -1, 1, 2, -2, 0, 1, 2, -1, 0, 2, -1, 1, 0],
    temperature: [0.1, 0, -0.1, 0.2, 0, -0.1, 0.1, 0, -0.2, 0.1, 0, 0.1, -0.1, 0.2, 0, -0.1, 0, 0.1, -0.1, 0.2, 0, -0.2, 0.1, 0, 0.1, -0.1, 0, 0.2, -0.1, 0],
    sleep: [0.3, -0.4, 0.6, 0.1, -0.7, 0.4, 0.2, -0.3, 0.5, -0.2, 0.4, -0.5, 0.2, 0.3, -0.1, 0.6, -0.4, 0.1, -0.2, 0.5, -0.6, 0.3, 0.2, -0.1, 0.4, -0.3, 0.5, -0.4, 0.2, 0],
    mood: [0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0],
    activity: [8, -5, 12, -4, 3, 9, -8, 4, -3, 6, -6, 10, 2, -7, 5, 8, -4, 1, -9, 7, -2, 6, -5, 4, 10, -6, 2, -3, 5, 0],
    spo2: [0, 1, 0, -1, 0, 1, -1, 0, 0, 1, 0, -1, 1, 0, 0, -1, 0, 1, 0, -1, 0, 1, 0, 0, -1, 1, 0, -1, 0, 0],
    glucose: [2, -3, 1, 0, -2, 4, -1, 3, -2, 0, 1, -4, 2, 0, 3, -1, -2, 4, 0, -3, 1, 2, -1, -2, 3, 0, -4, 2, 1, 0],
    stress: [0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0],
    dose: [0.04, 0.05, 0.03, 0.06, 0.04, 0.05, 0.04, 0.03, 0.05, 0.04, 0.06, 0.03, 0.04, 0.05, 0.04, 0.03, 0.06, 0.04, 0.05, 0.03, 0.04, 0.05, 0.04, 0.06, 0.03, 0.04, 0.05, 0.04, 0.03, 0.05]
  };

  function profile(id) { return PROFILES.find((item) => item.id === id) || PROFILES[0]; }
  function dayStamp(daysAgo) {
    const date = new Date(MISSION_END + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }
  function valueFor(person, metricId, ago) {
    const index = 29 - ago;
    const shape = SHAPES[metricId] && SHAPES[metricId][index];
    switch (metricId) {
      case "heartRate": return person.base.heartRate + shape;
      case "bloodPressure": return { systolic: person.base.systolic + SHAPES.systolic[index], diastolic: person.base.diastolic + Math.round(SHAPES.systolic[index] * 0.6) };
      case "temperature": return Number((person.base.temperature + shape).toFixed(1));
      case "sleep": return Number(Math.max(3.5, Math.min(10, person.base.sleep + shape)).toFixed(1));
      case "mood": return Math.max(1, Math.min(5, person.base.mood + shape));
      case "activity": return Math.max(0, person.base.activity + shape);
      case "spo2": return Math.max(90, Math.min(100, person.base.spo2 + shape));
      case "glucose": return Math.max(50, person.base.glucose + shape);
      case "stress": return Math.max(1, Math.min(5, person.base.stress + shape));
      case "radiation": return Number((person.base.radiation + SHAPES.dose.slice(0, index + 1).reduce((sum, dose) => sum + dose, 0)).toFixed(2));
      default: return null;
    }
  }
  function getSeries(profileId, metricId, days) {
    if (!METRICS.some((item) => item.id === metricId)) throw new Error("Unknown metric: " + metricId);
    const person = profile(profileId);
    const count = days === 7 ? 7 : 30;
    return Array.from({ length: count }, (_, index) => {
      const ago = count - index - 1;
      return { date: dayStamp(ago), value: valueFor(person, metricId, ago) };
    });
  }
  function latest(profileId, metricId) { return getSeries(profileId, metricId, 30).at(-1).value; }
  function formatValue(metricId, value) {
    if (metricId === "bloodPressure") return value.systolic + "/" + value.diastolic;
    if (metricId === "temperature") return Number(value).toFixed(1);
    if (metricId === "sleep") return Number(value).toFixed(1);
    if (metricId === "radiation") return Number(value).toFixed(2);
    return String(value);
  }
  return { MISSION_END, METRICS, PROFILES, getProfile: profile, getSeries, latest, formatValue };
});
