import type { ResolvedNoteFormatting, useSettingsStore } from "../stores/settingsStore";

export const CANOTE_SETUP_STEPS = ["welcome", "microphone", "model", "api", "done"] as const;
export type CanoteSetupStep = (typeof CANOTE_SETUP_STEPS)[number];
export const CANOTE_SETUP_STEP_KEY = "canoteSetupStepV1";
export const CANOTE_SETUP_API_SKIP_KEY = "canoteSetupApiSkippedV1";

export function savedCanoteStep(value: string | null): CanoteSetupStep {
  return CANOTE_SETUP_STEPS.find((step) => step === value) ?? "welcome";
}

export function applyCanoteLocalModel(
  settings: Pick<
    ReturnType<typeof useSettingsStore.getState>,
    "setCloudTranscriptionForAllScopes" | "setMeetingWhisperModel" | "setUploadWhisperModel"
  >,
  model: string
): void {
  settings.setCloudTranscriptionForAllScopes({
    useLocalWhisper: true,
    localTranscriptionProvider: "whisper",
    whisperModel: model,
    allowOpenAIFallback: false,
  });
  settings.setMeetingWhisperModel(model);
  settings.setUploadWhisperModel(model);
}

export function canoteSummaryCheck(config: ResolvedNoteFormatting, providerApiKey: string) {
  const custom = config.mode === "self-hosted" || config.provider === "custom";
  return {
    scope: "reasoning" as const,
    provider: custom ? "custom" : config.provider,
    model: config.model.trim(),
    baseUrl: config.mode === "self-hosted" ? config.remoteUrl : config.cloudBaseUrl,
    apiKey: custom ? config.customApiKey : providerApiKey,
  };
}

export function canoteSummaryConfigured(config: ReturnType<typeof canoteSummaryCheck>): boolean {
  return Boolean(
    config.model &&
    config.provider &&
    (config.provider === "custom" ? config.baseUrl.trim() : config.apiKey.trim())
  );
}

export function completeCanoteSetup(storage: Pick<Storage, "setItem" | "removeItem">): void {
  storage.setItem("notesOnboardingComplete", "true");
  storage.setItem("authenticationSkipped", "true");
  storage.setItem("skipAuth", "true");
  storage.removeItem("onboardingSessionV2");
  storage.removeItem("onboardingCurrentStep");
  storage.removeItem(CANOTE_SETUP_STEP_KEY);
  storage.removeItem(CANOTE_SETUP_API_SKIP_KEY);
  storage.setItem("onboardingCompleted", "true");
}
