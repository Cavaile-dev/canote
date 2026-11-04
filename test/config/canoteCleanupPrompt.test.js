const test = require("node:test");
const assert = require("node:assert/strict");

test("Canote uses the Indonesian view prompt and resolves the editable agent placeholder", async (t) => {
  const { getDefaultPromptText, resolvePrompt } = await import("../../src/config/prompts/index.ts");
  const { CLEANUP_CUSTOMIZATION_PROMPT } =
    await import("../../src/config/cleanupCustomizationPrompt.ts");
  const { useSettingsStore } = await import("../../src/stores/settingsStore.ts");
  const original = useSettingsStore.getState().customPrompts;
  t.after(() => useSettingsStore.setState({ customPrompts: original }));

  useSettingsStore.setState({ customPrompts: { ...original, cleanup: "" } });
  const view = getDefaultPromptText("cleanup", "en");
  assert.ok(view.startsWith("Kamu adalah mesin pembersih transkrip"));
  assert.ok(view.includes('Penyebutan "OpenWhispr"'));
  assert.ok(view.includes("machine learning"));
  assert.equal(resolvePrompt("cleanup", { agentName: "OpenWhispr", uiLanguage: "en" }), view);

  assert.ok(CLEANUP_CUSTOMIZATION_PROMPT.includes('Penyebutan "{{agentName}}"'));
  useSettingsStore.setState({
    customPrompts: { ...original, cleanup: CLEANUP_CUSTOMIZATION_PROMPT },
  });
  const customized = resolvePrompt("cleanup", { agentName: "Pipin", uiLanguage: "en" });
  assert.ok(customized.includes('Penyebutan "Pipin"'));
  assert.ok(customized.includes("<transcript>"));
  assert.ok(!customized.includes("{{agentName}}"));
});
