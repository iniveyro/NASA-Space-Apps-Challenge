const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../data.js");

test("provides four uniquely identified fictional profiles and six supported metrics", () => {
  assert.equal(data.PROFILES.length, 4);
  assert.equal(new Set(data.PROFILES.map((profile) => profile.id)).size, 4);
  assert.equal(data.METRICS.length, 6);
  assert.equal(new Set(data.METRICS.map((metric) => metric.id)).size, 6);
  assert.deepEqual(data.PROFILES.map((profile) => profile.health), ["warning", "stable", "alert", "stable"]);
  assert.equal(data.PROFILES[3].activity, "resting");
  assert.equal(data.PROFILES[3].health, "stable");
});

test("every profile and metric has deterministic 7- and 30-day histories", () => {
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

test("blood pressure readings preserve separate paired systolic and diastolic series", () => {
  for (const profile of data.PROFILES) {
    const readings = data.getSeries(profile.id, "bloodPressure", 30);
    assert.ok(readings.every(({ value }) => Number.isInteger(value.systolic) && Number.isInteger(value.diastolic)));
    assert.ok(readings.every(({ value }) => value.systolic > value.diastolic));
    assert.equal(data.formatValue("bloodPressure", readings.at(-1).value), `${profile.base.systolic}/${profile.base.diastolic}`);
  }
});

test("activity state is independent from health state and profile-specific values", () => {
  const restingCrew = data.getProfile("noah-williams");
  assert.equal(restingCrew.activity, "resting");
  assert.equal(restingCrew.health, "stable");
  assert.equal(data.latest(restingCrew.id, "activity"), 8);
  assert.equal(data.getProfile("mira-chen").health, "warning");
  assert.equal(data.getProfile("sofia-alvarez").health, "alert");
});

test("body-map associations cover pulse and pressure, self-reported sleep and mood, and whole-body signals", () => {
  const byId = Object.fromEntries(data.METRICS.map((metric) => [metric.id, metric]));
  assert.deepEqual([byId.heartRate.region, byId.bloodPressure.region], ["heart", "heart"]);
  assert.deepEqual([byId.sleep.region, byId.mood.region], ["brain", "brain"]);
  assert.match(byId.sleep.description, /self-reported/i);
  assert.match(byId.mood.description, /self-reported/i);
  assert.deepEqual([byId.temperature.region, byId.activity.region], ["body", "body"]);
});

test("metric units and categorical mood scale are explicit", () => {
  const metrics = Object.fromEntries(data.METRICS.map((metric) => [metric.id, metric]));
  assert.equal(metrics.heartRate.unit, "bpm");
  assert.equal(metrics.bloodPressure.unit, "mmHg");
  assert.equal(metrics.temperature.unit, "°C");
  assert.equal(metrics.sleep.unit, "h");
  assert.equal(metrics.activity.unit, "min");
  assert.equal(metrics.mood.unit, "/ 5");
  for (const profile of data.PROFILES) {
    const moods = data.getSeries(profile.id, "mood", 30);
    assert.ok(moods.every(({ value }) => Number.isInteger(value) && value >= 1 && value <= 5));
  }
});
