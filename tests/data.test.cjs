const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../data.js");

test("provides four uniquely identified fictional profiles with demographics and independent statuses", () => {
  assert.equal(data.PROFILES.length, 4);
  assert.equal(new Set(data.PROFILES.map((profile) => profile.id)).size, 4);
  assert.ok(data.PROFILES.every((profile) => profile.age > 0 && profile.weightKg > 0 && profile.sex));
  assert.equal(data.PROFILES[3].activity, "resting");
  assert.equal(data.PROFILES[3].health, "stable");
  assert.deepEqual(data.PROFILES.map((profile) => profile.health), ["monitoring", "stable", "simulated-alert", "stable"]);
});

test("provides ten uniquely identified metrics with explicit units and regions", () => {
  assert.equal(data.METRICS.length, 10);
  assert.equal(new Set(data.METRICS.map((metric) => metric.id)).size, 10);
  const metrics = Object.fromEntries(data.METRICS.map((metric) => [metric.id, metric]));
  assert.equal(metrics.heartRate.unit, "bpm");
  assert.equal(metrics.bloodPressure.unit, "mmHg");
  assert.equal(metrics.temperature.unit, "°C");
  assert.equal(metrics.spo2.unit, "%");
  assert.equal(metrics.glucose.unit, "mg/dL");
  assert.equal(metrics.radiation.unit, "mGy");
  assert.equal(metrics.radiation.region, "body");
  assert.equal(metrics.sleep.region, "brain");
  assert.match(metrics.sleep.description, /self-reported/i);
  assert.match(metrics.stress.description, /self-reported/i);
  assert.match(metrics.spo2.description, /point reading.*not a continuous/i);
  assert.match(metrics.glucose.description, /point reading.*not a continuous/i);
});

test("every profile and metric has deterministic 7- and 30-day histories with matching latest values", () => {
  for (const profile of data.PROFILES) {
    for (const metric of data.METRICS) {
      const history = data.getSeries(profile.id, metric.id, 30);
      const shortHistory = data.getSeries(profile.id, metric.id, 7);
      assert.equal(history.length, 30);
      assert.equal(shortHistory.length, 7);
      assert.deepEqual(data.getSeries(profile.id, metric.id, 30), history);
      assert.deepEqual(shortHistory, history.slice(-7));
      assert.equal(history.at(-1).date, data.MISSION_END);
      assert.deepEqual(history.at(-1).value, data.latest(profile.id, metric.id));
    }
  }
});

test("blood pressure retains separate paired systolic and diastolic readings", () => {
  for (const profile of data.PROFILES) {
    const readings = data.getSeries(profile.id, "bloodPressure", 30);
    assert.ok(readings.every(({ value }) => Number.isInteger(value.systolic) && Number.isInteger(value.diastolic)));
    assert.ok(readings.every(({ value }) => value.systolic > value.diastolic));
    assert.equal(data.formatValue("bloodPressure", readings.at(-1).value), `${profile.base.systolic}/${profile.base.diastolic}`);
  }
});

test("cumulative radiation stays nonnegative, monotonically increasing, and formatted as dose", () => {
  for (const profile of data.PROFILES) {
    const readings = data.getSeries(profile.id, "radiation", 30).map(({ value }) => value);
    assert.ok(readings.every((value) => value >= 0));
    assert.ok(readings.every((value, index) => index === 0 || value >= readings[index - 1]));
    assert.ok(readings.some((value, index) => index > 0 && value > readings[index - 1]));
    assert.match(data.formatValue("radiation", readings.at(-1)), /^\d+\.\d{2}$/);
  }
});

test("categorical self-reports stay on their declared five-point scale", () => {
  for (const profile of data.PROFILES) {
    for (const metricId of ["mood", "stress"]) {
      assert.ok(data.getSeries(profile.id, metricId, 30).every(({ value }) => Number.isInteger(value) && value >= 1 && value <= 5));
    }
  }
});

test("unknown metric identifiers fail rather than returning an empty history", () => {
  assert.throws(() => data.getSeries("mira-chen", "unknown", 30), /Unknown metric/);
});

test("every fictional profile has explicit demo reference scenarios for all ten metrics", () => {
  const states = [];
  for (const profile of data.PROFILES) {
    for (const metric of data.METRICS) {
      const reading = data.latest(profile.id, metric.id);
      const scenario = data.resolveMetricScenario(profile.id, metric.id, reading);
      assert.ok(["within-demo-reference", "demo-deviation", "demo-alert"].includes(scenario.status), `${profile.id}/${metric.id}`);
      assert.ok(scenario.label && scenario.reference && scenario.evidence.includes("not calculated"));
      assert.ok(scenario.baseline != null, `${profile.id}/${metric.id} must show its fictional baseline context`);
      states.push(scenario.status);
    }
  }
  assert.ok(states.filter((status) => status === "within-demo-reference").length >= 38, "most authored scenarios should be green");
  assert.equal(data.resolveMetricScenario("sofia-alvarez", "heartRate", data.latest("sofia-alvarez", "heartRate")).status, "demo-alert");
  assert.equal(data.resolveMetricScenario("mira-chen", "bloodPressure", data.latest("mira-chen", "bloodPressure")).status, "demo-deviation");
  assert.match(data.METRICS.find((metric) => metric.id === "radiation").demoReference, /not a personal-physiology baseline or a universal safe limit/i);
});

test("scenario resolution is metadata-driven, non-mutating, and unknown when required context is missing", () => {
  const before = JSON.stringify(data.PROFILES);
  const reference = data.resolveMetricScenario("sofia-alvarez", "heartRate", 1);
  assert.equal(reference.status, "demo-alert", "status must not be inferred from the supplied numeric reading");
  assert.equal(data.resolveMetricScenario("sofia-alvarez", "heartRate", null).status, "unknown");
  assert.equal(data.resolveMetricScenario("missing-profile", "heartRate", 72).status, "unknown");
  assert.equal(data.resolveMetricScenario("sofia-alvarez", "missing-metric", 72).status, "unknown");
  assert.equal(JSON.stringify(data.PROFILES), before, "resolution must not mutate fixture profiles");
  assert.equal(data.ENVIRONMENT, "Microgravity");
  assert.match(data.METRICS.find((metric) => metric.id === "sleep").demoReference, /self-reported/i);
  assert.match(data.METRICS.find((metric) => metric.id === "stress").description, /self-reported/i);
});

test("incomplete or non-finite paired readings and baselines resolve to explicit unknown", () => {
  const profile = data.PROFILES.find((item) => item.id === "mira-chen");
  const complete = { systolic: 118, diastolic: 76 };
  const malformedReadings = [
    { systolic: 118 },
    { diastolic: 76 },
    { systolic: 118, diastolic: null },
    { systolic: Infinity, diastolic: 76 },
    { systolic: 118, diastolic: NaN }
  ];
  for (const reading of malformedReadings) {
    const scenario = data.resolveMetricScenario(profile.id, "bloodPressure", reading);
    assertUnknownScenario(scenario);
    assert.equal(data.formatValue("bloodPressure", reading), "Unknown");
  }
  assert.equal(data.resolveMetricScenario(profile.id, "bloodPressure", complete).status, "demo-deviation");

  const original = profile.base.diastolic;
  try {
    delete profile.base.diastolic;
    assertUnknownScenario(data.resolveMetricScenario(profile.id, "bloodPressure", complete));
    for (const baseline of [null, NaN, Infinity, -Infinity]) {
      profile.base.diastolic = baseline;
      assertUnknownScenario(data.resolveMetricScenario(profile.id, "bloodPressure", complete));
    }
  } finally {
    profile.base.diastolic = original;
  }
});

test("non-finite scalar readings and baselines resolve to unknown without changing fixtures", () => {
  const profile = data.PROFILES.find((item) => item.id === "sofia-alvarez");
  const original = profile.base.heartRate;
  const before = JSON.stringify(data.PROFILES);
  try {
    for (const reading of [null, undefined, NaN, Infinity, -Infinity]) {
      assertUnknownScenario(data.resolveMetricScenario(profile.id, "heartRate", reading));
      assert.equal(data.formatValue("heartRate", reading), "Unknown");
    }
    for (const baseline of [null, NaN, Infinity, -Infinity]) {
      profile.base.heartRate = baseline;
      assertUnknownScenario(data.resolveMetricScenario(profile.id, "heartRate", 104));
    }
  } finally {
    profile.base.heartRate = original;
  }
  assert.equal(JSON.stringify(data.PROFILES), before);
  assert.equal(data.resolveMetricScenario(profile.id, "heartRate", data.latest(profile.id, "heartRate")).status, "demo-alert");
});

function assertUnknownScenario(scenario) {
  assert.equal(scenario.status, "unknown");
  assert.equal(scenario.label, "Unknown");
  assert.equal(scenario.baseline, null);
  assert.equal(scenario.baselineLabel, "Demo reference unavailable");
  assert.match(scenario.reference, /complete finite fictional reading and reference/i);
  assert.doesNotMatch(`${scenario.label} ${scenario.baselineLabel} ${scenario.reference} ${scenario.evidence}`, /\b(?:undefined|NaN|Infinity)\b/);
}
