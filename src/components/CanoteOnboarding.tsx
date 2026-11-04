import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "./ui/button";
import { Check, Download, Loader2, Mic, NotebookPen, RefreshCw } from "./icons";
import WindowControls from "./WindowControls";
import InferenceConfigEditor from "./settings/InferenceConfigEditor";
import { cn } from "./lib/utils";
import { useSettingsStore, selectResolvedNoteFormatting } from "../stores/settingsStore";
import { getWhisperModels } from "../models/ModelRegistry";
import { useModelDownload } from "../hooks/useModelDownload";
import { useConnectionAutoCheck } from "../hooks/useConnectionAutoCheck";
import { BYOK_API_KEYS } from "../config/secretKeys";
import {
  CANOTE_SETUP_STEPS,
  CANOTE_SETUP_STEP_KEY,
  CANOTE_SETUP_API_SKIP_KEY,
  savedCanoteStep,
  canoteSummaryCheck,
  canoteSummaryConfigured,
  completeCanoteSetup,
  applyCanoteLocalModel,
  type CanoteSetupStep,
} from "../helpers/canoteSetup";

const LABELS = {
  welcome: "Selamat datang",
  microphone: "Mikrofon",
  model: "Model transkrip lokal",
  api: "API ringkasan",
  done: "Selesai",
};
const WHISPER_MODELS = getWhisperModels();

export default function CanoteOnboarding({
  onComplete,
}: {
  onComplete: (options?: { openSettings?: boolean }) => void;
}) {
  const store = useSettingsStore();
  const [step, setStep] = useState<CanoteSetupStep>(() =>
    savedCanoteStep(localStorage.getItem(CANOTE_SETUP_STEP_KEY))
  );
  const [apiSkipped, setApiSkipped] = useState(
    () => localStorage.getItem(CANOTE_SETUP_API_SKIP_KEY) === "true"
  );
  const [micReady, setMicReady] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(
    () => store.meetingWhisperModel || store.whisperModel || "small"
  );
  const [installedModels, setInstalledModels] = useState<Set<string>>(new Set());
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const finishLock = useRef(false);
  const modelQuery = useRef(0);
  const summary = selectResolvedNoteFormatting(store);
  const keyEntry = BYOK_API_KEYS.find((key) => key.base === summary.provider);
  const providerKey = keyEntry ? store[keyEntry.storeKey as keyof typeof store] : "";
  const apiConfig = canoteSummaryCheck(summary, typeof providerKey === "string" ? providerKey : "");
  const apiModeAllowed = summary.mode === "providers" || summary.mode === "self-hosted";
  const check = useConnectionAutoCheck({
    config: apiConfig,
    ready: step === "api" && apiModeAllowed && canoteSummaryConfigured(apiConfig),
  });
  const modelReady = installedModels.has(selectedModel) && Boolean(WHISPER_MODELS[selectedModel]);
  const index = CANOTE_SETUP_STEPS.indexOf(step);
  const setNoteFormattingMode = store.setNoteFormattingMode;

  useEffect(() => {
    void window.electronAPI?.setOnboardingWindowMode?.("expanded");
  }, []);

  useEffect(() => {
    localStorage.setItem(CANOTE_SETUP_STEP_KEY, step);
  }, [step]);
  useEffect(() => {
    if (step === "api" && !apiModeAllowed) setNoteFormattingMode("providers");
  }, [step, apiModeAllowed, setNoteFormattingMode]);

  const refreshModels = useCallback(async () => {
    const request = ++modelQuery.current;
    setModelsLoading(true);
    try {
      const result = await window.electronAPI.listWhisperModels();
      if (!result.success) throw new Error("Model list unavailable");
      if (request === modelQuery.current)
        setInstalledModels(
          new Set(result.models.filter((model) => model.downloaded).map((model) => model.model))
        );
    } catch {
      if (request === modelQuery.current)
        setError("Daftar model belum bisa dibaca. Coba muat ulang.");
    } finally {
      if (request === modelQuery.current) setModelsLoading(false);
    }
  }, []);
  const download = useModelDownload({
    modelType: "whisper",
    onDownloadComplete: refreshModels,
    onModelsCleared: refreshModels,
  });
  useEffect(() => {
    const pendingQueries = modelQuery;
    void refreshModels();
    return () => {
      pendingQueries.current++;
    };
  }, [refreshModels]);

  const goTo = (next: CanoteSetupStep) => {
    setError("");
    setStep(next);
  };
  const selectModel = (model: string) => {
    setSelectedModel(model);
    applyCanoteLocalModel(useSettingsStore.getState(), model);
  };
  const deferApi = (deferred: boolean) => {
    setApiSkipped(deferred);
    localStorage.setItem(CANOTE_SETUP_API_SKIP_KEY, String(deferred));
  };

  const requestMic = async () => {
    setMicBusy(true);
    setMicReady(false);
    setError("");
    let stream: MediaStream | undefined;
    try {
      await window.electronAPI?.requestMicrophoneAccess?.();
      const deviceId =
        store.microphoneSelectionMode === "specific" ? store.selectedMicDeviceId : "";
      stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === "audioinput"
        )
      );
      localStorage.setItem("micPermissionGranted", "true");
      setMicReady(true);
    } catch {
      setError(
        "Mikrofon belum bisa diakses. Periksa izin mikrofon Windows dan perangkat yang dipilih, lalu coba lagi. Kamu juga bisa melewati langkah ini untuk memakai impor file."
      );
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setMicBusy(false);
    }
  };

  const finish = async () => {
    if (finishLock.current) return;
    finishLock.current = true;
    setFinishing(true);
    setError("");
    try {
      const models = await window.electronAPI.listWhisperModels();
      if (
        !models.success ||
        !models.models.some((model) => model.model === selectedModel && model.downloaded)
      ) {
        goTo("model");
        throw new Error(
          "Model transkrip belum tersedia. Unduh atau pilih model yang sudah terpasang."
        );
      }
      if (!apiSkipped) {
        const current = useSettingsStore.getState();
        const config = selectResolvedNoteFormatting(current);
        if (config.mode !== "providers" && config.mode !== "self-hosted") {
          goTo("api");
          throw new Error("Pilih provider API atau endpoint sendiri untuk membuat ringkasan.");
        }
        const key = BYOK_API_KEYS.find((item) => item.base === config.provider);
        const value = key ? current[key.storeKey as keyof typeof current] : "";
        const connection = canoteSummaryCheck(config, typeof value === "string" ? value : "");
        const result =
          canoteSummaryConfigured(connection) &&
          (await window.electronAPI.testProviderConnection?.(connection));
        if (!result || !result.success) {
          goTo("api");
          throw new Error(
            "Koneksi API belum berhasil. Periksa provider, endpoint, API key, dan model, atau pilih Atur nanti."
          );
        }
      }
      selectModel(selectedModel);
      const saved = await window.electronAPI.saveAllKeysToEnv();
      if (!saved.success) throw new Error("Pengaturan API belum bisa disimpan. Coba lagi.");
      await window.electronAPI?.setOnboardingWindowMode?.("restore");
      completeCanoteSetup(localStorage);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup belum bisa disimpan. Coba lagi.");
    } finally {
      finishLock.current = false;
      setFinishing(false);
    }
  };

  const next = () => {
    if (step === "model") selectModel(selectedModel);
    if (step === "api") deferApi(false);
    goTo(CANOTE_SETUP_STEPS[index + 1]);
  };
  const nextDisabled =
    micBusy ||
    finishing ||
    download.isDownloading ||
    (step === "microphone" && !micReady) ||
    (step === "model" && (!modelReady || modelsLoading)) ||
    (step === "api" && check.phase !== "connected");

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header
        className="flex h-12 shrink-0 items-center justify-between border-b border-primary/10 px-5"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <NotebookPen size={18} /> Canote
        </span>
        <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <WindowControls />
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto bg-primary/3 px-5 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <ol
            className="flex flex-wrap justify-center gap-x-5 gap-y-2"
            aria-label="Langkah setup Canote"
          >
            {CANOTE_SETUP_STEPS.map((item, i) => (
              <li
                key={item}
                aria-current={item === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  i <= index ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    i <= index && "border-primary bg-primary/10"
                  )}
                >
                  {i < index ? <Check size={12} /> : i + 1}
                </span>
                {LABELS[item]}
              </li>
            ))}
          </ol>
          <section
            className="rounded-3xl border border-primary/15 bg-card p-6 shadow-sm sm:p-8"
            aria-labelledby="setup-title"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              Canote · Langkah {index + 1} dari 5
            </p>
            <h1 id="setup-title" className="mb-5 text-3xl font-semibold">
              {step === "welcome"
                ? "Selamat datang di Canote"
                : step === "done"
                  ? "Canote siap menemani kuliahmu"
                  : LABELS[step]}
            </h1>
            {step === "welcome" && (
              <div className="space-y-5 text-sm leading-7 text-muted-foreground">
                <p>
                  Rekam kuliah lewat mikrofon atau impor file. Canote membuat transkrip, ringkasan
                  terstruktur, highlight penting, serta daftar Tugas, Quiz, dan Ulangan.
                </p>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                  <p>
                    Transkrip memakai model lokal gratis. Ringkasan memakai API pilihanmu; teks
                    transkrip dikirim ke provider tersebut dan biaya mengikuti providernya.
                  </p>
                </div>
                <p>
                  Kita siapkan mikrofon, unduh model transkrip, lalu hubungkan API ringkasan. Kamu
                  tidak perlu membuat akun Canote.
                </p>
              </div>
            )}
            {step === "microphone" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Izinkan Canote mengakses mikrofon. Pengecekan ini tidak menyimpan rekaman.
                </p>
                <Button onClick={() => void requestMic()} disabled={micBusy}>
                  {micBusy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  {micReady ? "Cek ulang mikrofon" : "Izinkan dan cek mikrofon"}
                </Button>
                {micReady && (
                  <p role="status" className="text-sm text-primary">
                    Mikrofon berhasil diakses.
                  </p>
                )}
                {devices.length > 0 && (
                  <label className="block space-y-2 text-sm">
                    <span>Pilih mikrofon</span>
                    <select
                      className="w-full rounded-xl border border-border bg-background px-3 py-2"
                      value={
                        store.microphoneSelectionMode === "specific"
                          ? store.selectedMicDeviceId
                          : "system"
                      }
                      onChange={(event) => {
                        const id = event.target.value;
                        const device = devices.find((item) => item.deviceId === id);
                        store.setMicrophoneSelectionMode(id === "system" ? "system" : "specific");
                        if (device) store.setSelectedMicDevice(id, device.label);
                        setMicReady(false);
                      }}
                    >
                      <option value="system">Mikrofon default Windows</option>
                      {devices
                        .filter((device) => device.deviceId !== "default")
                        .map((device, i) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Mikrofon ${i + 1}`}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  Kalau hanya ingin mengimpor file, kamu bisa mengatur mikrofon nanti.
                </p>
              </div>
            )}
            {step === "model" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Whisper multilingual mendukung kuliah Indonesia dengan istilah Inggris. Small
                  adalah pilihan awal. Model dipakai untuk rekaman dan impor file; unduh sekali,
                  lalu transkrip bisa berjalan tanpa internet.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setError("");
                    void refreshModels();
                  }}
                  disabled={modelsLoading}
                >
                  <RefreshCw size={14} className={modelsLoading ? "animate-spin" : ""} />
                  Muat ulang daftar
                </Button>
                <div className="space-y-2">
                  {Object.entries(WHISPER_MODELS)
                    .filter(([id]) => !id.endsWith(".en"))
                    .map(([id, model]) => {
                      const installed = installedModels.has(id);
                      const active = download.isDownloadingModel(id);
                      return (
                        <div
                          key={id}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
                            id === selectedModel && installed
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          )}
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              Whisper {model.name}
                              {id === "small" && (
                                <span className="ml-2 text-xs font-normal text-primary">
                                  Pilihan awal
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {model.size} · Multilingual
                            </p>
                          </div>
                          {installed ? (
                            <Button
                              size="sm"
                              variant={id === selectedModel ? "default" : "outline"}
                              onClick={() => selectModel(id)}
                              disabled={download.isDownloading}
                            >
                              {id === selectedModel ? (
                                <>
                                  <Check size={14} />
                                  Dipilih
                                </>
                              ) : (
                                "Pilih"
                              )}
                            </Button>
                          ) : active ? (
                            <div className="flex items-center gap-2 text-sm">
                              <span role="status">
                                {download.isInstalling
                                  ? "Memasang…"
                                  : `${Math.round(download.downloadProgress.percentage)}%`}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={download.isInstalling || download.isCancelling}
                                onClick={() => void download.cancelDownload(id)}
                              >
                                Batal
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={download.isDownloading || modelsLoading}
                              onClick={() => void download.downloadModel(id, selectModel)}
                            >
                              <Download size={14} />
                              Unduh
                            </Button>
                          )}
                        </div>
                      );
                    })}
                </div>
                {download.downloadError && (
                  <p role="alert" className="text-sm text-destructive">
                    {download.downloadError}
                  </p>
                )}
              </div>
            )}
            {step === "api" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pilih provider API atau endpoint sendiri, isi API key jika diperlukan, lalu pilih
                  model untuk Ringkasan, Tugas, Quiz, dan Ulangan.
                </p>
                <InferenceConfigEditor
                  scope="noteFormatting"
                  allowedModes={["providers", "self-hosted"]}
                />
                <div
                  className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm"
                  aria-live="polite"
                >
                  {check.phase === "connected"
                    ? "Koneksi API berhasil. Kamu bisa melanjutkan."
                    : check.phase === "checking" || check.phase === "waiting"
                      ? "Memeriksa koneksi API…"
                      : check.failure
                        ? check.failure.errorCode === "credentialsRejected"
                          ? "API key ditolak. Periksa kembali key dan endpoint yang dipakai."
                          : check.failure.errorCode === "modelNotFound"
                            ? "Model tidak ditemukan pada provider ini."
                            : "Koneksi API belum berhasil. Periksa konfigurasi, lalu coba lagi."
                        : "Lengkapi konfigurasi untuk memeriksa koneksi, atau pilih Atur nanti."}
                  {check.failure && (
                    <Button size="sm" variant="outline" className="ml-3" onClick={check.retry}>
                      Coba lagi
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Kamu bisa melewati API dan mengaturnya nanti di Settings → Language Models → Note
                  Formatting. Transkrip lokal tetap dapat digunakan.
                </p>
              </div>
            )}
            {step === "done" && (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Pengaturan tersimpan. Kamu bisa mulai dari Smart Note dan membuat note lewat
                  tombol tambah di folder.
                </p>
                <ul className="space-y-3 rounded-2xl bg-primary/5 p-5">
                  <li>Mikrofon: {micReady ? "sudah dicek" : "bisa dicek saat mulai merekam"}</li>
                  <li>
                    Transkrip lokal: Whisper {WHISPER_MODELS[selectedModel]?.name || selectedModel}
                  </li>
                  <li>API ringkasan: {apiSkipped ? "diatur nanti" : summary.model}</li>
                </ul>
                <p className="text-muted-foreground">
                  Gunakan ikon mic untuk merekam, atau ikon upload untuk impor file. Setelah
                  transkrip tersedia, Canote menyusun ringkasan dan kandidat Tugas, Quiz, serta
                  Ulangan untuk kamu review.
                </p>
              </div>
            )}
          </section>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-card p-4 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {index > 0 && (
                <Button
                  variant="outline"
                  disabled={micBusy || finishing || download.isDownloading}
                  onClick={() => goTo(CANOTE_SETUP_STEPS[index - 1])}
                >
                  Kembali
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {(step === "microphone" || step === "api") && (
                <Button
                  variant="ghost"
                  disabled={micBusy || finishing}
                  onClick={() => {
                    if (step === "api") {
                      deferApi(true);
                      goTo("done");
                    } else goTo("model");
                  }}
                >
                  Atur nanti
                </Button>
              )}
              <Button
                disabled={nextDisabled}
                onClick={() => (step === "done" ? void finish() : next())}
              >
                {finishing && <Loader2 size={15} className="animate-spin" />}
                {step === "welcome" ? "Mulai setup" : step === "done" ? "Buka Canote" : "Lanjut"}
              </Button>
            </div>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-primary">
            <span aria-hidden="true">♥</span>
            Made with love -Pipin
          </p>
        </div>
      </div>
    </main>
  );
}
