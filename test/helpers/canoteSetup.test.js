const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../../src/helpers/canoteSetup.ts");

test("setup resumes valid steps and safely resets unknown or old step names", async () => {
  const { CANOTE_SETUP_STEPS, savedCanoteStep } = await load();
  assert.deepEqual(CANOTE_SETUP_STEPS, ["welcome", "microphone", "model", "api", "done"]);
  for (const step of CANOTE_SETUP_STEPS) assert.equal(savedCanoteStep(step), step);
  for (const step of [null, "", "auth", "dictation-demo", "unknown"]) {
    assert.equal(savedCanoteStep(step), "welcome");
  }
});

test("local model selection configures recording and imports without modifying the summary provider", async (t) => {
  const { applyCanoteLocalModel } = await load();
  const { useSettingsStore, selectResolvedMeetingTranscription } =
    await import("../../src/stores/settingsStore.ts");
  const original = useSettingsStore.getState();
  t.after(() => useSettingsStore.setState(original));
  useSettingsStore.setState({
    transcriptionMode: "providers",
    meetingTranscriptionMode: "providers",
    uploadTranscriptionMode: "providers",
    useLocalWhisper: false,
    meetingUseLocalWhisper: false,
    uploadUseLocalWhisper: false,
    noteFormattingMode: "self-hosted",
    noteFormattingRemoteUrl: "http://localhost:8000/v1",
    noteFormattingModel: "summary-model",
    noteFormattingCustomApiKey: "test-summary-key",
  });
  applyCanoteLocalModel(useSettingsStore.getState(), "turbo-q5");
  const settings = useSettingsStore.getState();
  for (const prefix of ["", "meeting", "upload"]) {
    const key = (name) => (prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name);
    assert.equal(settings[key("transcriptionMode")], "local");
    assert.equal(settings[key("useLocalWhisper")], true);
    assert.equal(settings[key("localTranscriptionProvider")], "whisper");
    assert.equal(settings[key("whisperModel")], "turbo-q5");
  }
  assert.equal(selectResolvedMeetingTranscription(settings).whisperModel, "turbo-q5");
  assert.equal(settings.allowOpenAIFallback, false);
  assert.equal(settings.noteFormattingMode, "self-hosted");
  assert.equal(settings.noteFormattingRemoteUrl, "http://localhost:8000/v1");
  assert.equal(settings.noteFormattingModel, "summary-model");
  assert.equal(settings.noteFormattingCustomApiKey, "test-summary-key");
});

test("summary verification uses this scope's endpoint and key for custom and self-hosted modes", async () => {
  const { canoteSummaryCheck, canoteSummaryConfigured } = await load();
  const config = {
    mode: "providers",
    provider: "custom",
    model: " my-model ",
    cloudBaseUrl: "https://notes.example/v1",
    remoteUrl: "http://localhost:8000/v1",
    customApiKey: "scoped-key",
  };
  const custom = canoteSummaryCheck(config, "unrelated-hosted-key");
  assert.equal(custom.apiKey, "scoped-key");
  assert.equal(custom.baseUrl, "https://notes.example/v1");
  assert.equal(custom.model, "my-model");
  assert.equal(canoteSummaryConfigured(custom), true);
  const selfHosted = canoteSummaryCheck(
    { ...config, mode: "self-hosted", provider: "openai", customApiKey: "" },
    "hosted-key"
  );
  assert.equal(selfHosted.provider, "custom");
  assert.equal(selfHosted.baseUrl, "http://localhost:8000/v1");
  assert.equal(selfHosted.apiKey, "");
  assert.equal(canoteSummaryConfigured(selfHosted), true, "local endpoints may not require a key");
  const hosted = canoteSummaryCheck({ ...config, provider: "openai" }, "hosted-key");
  assert.equal(hosted.apiKey, "hosted-key");
  assert.equal(canoteSummaryConfigured({ ...hosted, apiKey: "" }), false);
  assert.equal(canoteSummaryConfigured({ ...custom, baseUrl: "" }), false);
  assert.equal(canoteSummaryConfigured({ ...custom, model: "" }), false);
});

test("completion saves guest choices and clears setup progress while preserving notes and keys", async () => {
  const { completeCanoteSetup, CANOTE_SETUP_STEP_KEY, CANOTE_SETUP_API_SKIP_KEY } = await load();
  const data = new Map([
    [CANOTE_SETUP_STEP_KEY, "done"],
    [CANOTE_SETUP_API_SKIP_KEY, "true"],
    ["onboardingSessionV2", "old session"],
    ["onboardingCurrentStep", "auth"],
    ["note-data", "preserve"],
    ["saved-api-key", "preserve"],
  ]);
  const storage = {
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  completeCanoteSetup(storage);
  completeCanoteSetup(storage);
  for (const key of [
    "onboardingCompleted",
    "notesOnboardingComplete",
    "authenticationSkipped",
    "skipAuth",
  ])
    assert.equal(data.get(key), "true");
  for (const key of [
    CANOTE_SETUP_STEP_KEY,
    CANOTE_SETUP_API_SKIP_KEY,
    "onboardingSessionV2",
    "onboardingCurrentStep",
  ])
    assert.equal(data.has(key), false);
  assert.equal(data.get("note-data"), "preserve");
  assert.equal(data.get("saved-api-key"), "preserve");
});

test("a storage failure does not mark onboarding complete", async () => {
  const { completeCanoteSetup } = await load();
  const written = new Map();
  assert.throws(
    () =>
      completeCanoteSetup({
        setItem(key, value) {
          if (key === "skipAuth") throw new Error("storage full");
          written.set(key, value);
        },
        removeItem() {},
      }),
    /storage full/
  );
  assert.equal(written.has("onboardingCompleted"), false);
});
