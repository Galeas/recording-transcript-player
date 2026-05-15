import { FileView, TFile, WorkspaceLeaf, normalizePath } from "obsidian";

import type RecordingTranscriptPlayerPlugin from "./main";
import { shouldRestorePlaybackPosition } from "./playback-position";
import { getSubtitleCandidates } from "./subtitle-resolution";
import { TranscriptCue, countActiveCues, findActiveCue, parseSubtitleSource } from "./srt";

export const VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER = "recording-transcript-player-view";

export class RecordingTranscriptPlayerView extends FileView {
  private audioEl?: HTMLAudioElement;
  private activeCueEl?: HTMLElement;
  private autoScroll = true;
  private cleanupController?: AbortController;
  private cueElements = new Map<number, HTMLElement>();
  private cues: TranscriptCue[] = [];
  private lastSavedAt = 0;
  private statusEl?: HTMLElement;
  private timeEl?: HTMLElement;
  private cueCountEl?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: RecordingTranscriptPlayerPlugin) {
    super(leaf);
    this.autoScroll = plugin.settings.autoScroll;
  }

  getViewType(): string {
    return VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER;
  }

  getDisplayText(): string {
    return this.file?.name ?? "Recording Transcript Player";
  }

  getIcon(): string {
    return "file-audio";
  }

  canAcceptExtension(extension: string): boolean {
    return this.plugin.settings.supportedAudioExtensions.includes(extension.toLowerCase());
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.cleanup();
    this.contentEl.empty();
    this.contentEl.addClass("rtp-view");
    this.autoScroll = this.plugin.settings.autoScroll;

    const shell = this.contentEl.createDiv({ cls: "rtp-shell" });
    const header = shell.createDiv({ cls: "rtp-header" });
    header.createDiv({ cls: "rtp-title", text: file.name });

    this.audioEl = header.createEl("audio", { cls: "rtp-audio" });
    this.audioEl.controls = true;
    this.audioEl.preload = "metadata";
    this.audioEl.src = this.app.vault.getResourcePath(file);

    const meta = header.createDiv({ cls: "rtp-meta" });
    this.timeEl = meta.createSpan({ cls: "rtp-time", text: "0:00 / --:--" });
    this.statusEl = meta.createSpan({ cls: "rtp-status", text: "Loading transcript..." });
    this.cueCountEl = meta.createSpan({ cls: "rtp-cue-count", text: "0 active / 0 cues" });

    const autoScrollSetting = header.createDiv({ cls: "rtp-toggle" });
    const autoScrollCheckbox = autoScrollSetting.createEl("input", {
      attr: { type: "checkbox" }
    });
    autoScrollCheckbox.checked = this.autoScroll;
    autoScrollSetting.createEl("span", { text: "Auto-scroll" });

    const transcriptEl = shell.createDiv({ cls: "rtp-transcript" });
    const transcriptResult = await this.loadTranscript(file);
    this.cues = transcriptResult.cues;
    this.renderTranscript(transcriptEl, transcriptResult);
    this.bindAudioEvents(file, autoScrollCheckbox);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    await this.saveCurrentPosition(file);
    this.cleanup();
    this.cues = [];
    this.cueElements.clear();
    this.activeCueEl = undefined;
    await super.onUnloadFile(file);
  }

  private async loadTranscript(audioFile: TFile): Promise<TranscriptLoadResult> {
    const subtitleFile = this.findSubtitleFile(audioFile);
    if (!subtitleFile) {
      this.setStatus("No matching subtitle file found");
      return { cues: [], skippedBlocks: 0, subtitleFile: undefined, state: "missing" };
    }

    let source: string;
    try {
      source = await this.app.vault.cachedRead(subtitleFile);
    } catch (error) {
      console.error("Recording Transcript Player: failed to read subtitle file", error);
      this.setStatus(`Could not read ${subtitleFile.name}`);
      return { cues: [], skippedBlocks: 0, subtitleFile, state: "empty" };
    }

    const parsed = parseSubtitleSource(source, subtitleFile.extension);
    const skippedMessage = parsed.skippedBlocks > 0 ? `, skipped ${parsed.skippedBlocks}` : "";
    this.setStatus(`${subtitleFile.name}${skippedMessage}`);
    return {
      ...parsed,
      subtitleFile,
      state: parsed.cues.length === 0 ? "empty" : "loaded"
    };
  }

  private findSubtitleFile(audioFile: TFile): TFile | undefined {
    const candidates = getSubtitleCandidates(audioFile.path, this.plugin.settings.subtitleExtensionPriority);
    for (const candidate of candidates) {
      const abstractFile = this.app.vault.getAbstractFileByPath(normalizePath(candidate));
      if (abstractFile instanceof TFile) {
        return abstractFile;
      }
    }
    return undefined;
  }

  private renderTranscript(transcriptEl: HTMLElement, result: TranscriptLoadResult): void {
    this.cueElements.clear();
    this.setCueCount(0, 0);

    if (result.state === "missing") {
      transcriptEl.createDiv({
        cls: "rtp-empty",
        text: "No matching subtitle file found. Audio playback is still available."
      });
      return;
    }

    if (result.cues.length === 0) {
      transcriptEl.createDiv({
        cls: "rtp-empty",
        text: "The subtitle file has no readable cues."
      });
      return;
    }

    this.setCueCount(0, result.cues.length);
    for (const cue of result.cues) {
      const row = transcriptEl.createDiv({ cls: "rtp-cue" });
      const button = row.createEl("button", {
        cls: "rtp-timestamp",
        text: cue.timestampLabel,
        attr: { type: "button" }
      });
      const body = row.createDiv({ cls: "rtp-cue-body" });
      if (cue.speaker) {
        body.createDiv({ cls: "rtp-speaker", text: cue.speaker });
      }
      for (const line of cue.text.split("\n")) {
        body.createDiv({ cls: "rtp-text", text: line });
      }

      button.addEventListener("click", () => {
        if (this.audioEl) {
          this.audioEl.currentTime = cue.startSeconds;
          void this.audioEl.play();
        }
      });
      this.cueElements.set(cue.index, row);
    }
  }

  private bindAudioEvents(file: TFile, autoScrollCheckbox: HTMLInputElement): void {
    if (!this.audioEl) {
      return;
    }

    const controller = new AbortController();
    this.cleanupController = controller;
    const options = { signal: controller.signal };

    autoScrollCheckbox.addEventListener(
      "change",
      () => {
        this.autoScroll = autoScrollCheckbox.checked;
      },
      options
    );

    this.audioEl.addEventListener(
      "loadedmetadata",
      () => {
        this.restorePlaybackPosition(file);
        this.updateTimeDisplay();
      },
      options
    );

    this.audioEl.addEventListener(
      "timeupdate",
      () => {
        this.updateTimeDisplay();
        this.updateActiveCue();
        void this.maybeSavePosition(file);
      },
      options
    );

    this.audioEl.addEventListener(
      "ended",
      () => {
        void this.saveCurrentPosition(file);
      },
      options
    );

    this.audioEl.addEventListener(
      "error",
      () => {
        this.setStatus("Audio playback error");
      },
      options
    );
  }

  private restorePlaybackPosition(file: TFile): void {
    if (!this.audioEl || !this.plugin.settings.resumePlayback) {
      return;
    }

    const savedPosition = this.plugin.getPlaybackPosition(file.path);
    if (savedPosition && shouldRestorePlaybackPosition(savedPosition, this.audioEl.duration)) {
      this.audioEl.currentTime = savedPosition;
    }
  }

  private updateTimeDisplay(): void {
    if (!this.audioEl || !this.timeEl) {
      return;
    }

    this.timeEl.setText(`${formatDuration(this.audioEl.currentTime)} / ${formatDuration(this.audioEl.duration)}`);
  }

  private updateActiveCue(): void {
    if (!this.audioEl) {
      return;
    }

    const activeCue = findActiveCue(this.cues, this.audioEl.currentTime);
    this.setCueCount(countActiveCues(this.cues, this.audioEl.currentTime), this.cues.length);
    const nextActiveEl = activeCue ? this.cueElements.get(activeCue.index) : undefined;
    if (this.activeCueEl === nextActiveEl) {
      return;
    }

    this.activeCueEl?.removeClass("is-active");
    this.activeCueEl = nextActiveEl;
    this.activeCueEl?.addClass("is-active");

    if (this.autoScroll && this.activeCueEl) {
      this.activeCueEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  private async maybeSavePosition(file: TFile): Promise<void> {
    if (!this.audioEl) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSavedAt < this.plugin.settings.savePositionIntervalSeconds * 1000) {
      return;
    }

    this.lastSavedAt = now;
    await this.saveCurrentPosition(file);
  }

  private async saveCurrentPosition(file: TFile): Promise<void> {
    if (this.audioEl && Number.isFinite(this.audioEl.currentTime)) {
      await this.plugin.setPlaybackPosition(file.path, this.audioEl.currentTime);
    }
  }

  private setStatus(message: string): void {
    this.statusEl?.setText(message);
  }

  private setCueCount(activeCount: number, totalCount: number): void {
    this.cueCountEl?.setText(
      `${activeCount} active / ${totalCount} cue${totalCount === 1 ? "" : "s"}`
    );
  }

  private cleanup(): void {
    this.cleanupController?.abort();
    this.cleanupController = undefined;
  }
}

interface TranscriptLoadResult {
  cues: TranscriptCue[];
  skippedBlocks: number;
  subtitleFile?: TFile;
  state: "loaded" | "empty" | "missing";
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
