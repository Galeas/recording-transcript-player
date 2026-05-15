import { FileView, TFile, WorkspaceLeaf, normalizePath } from "obsidian";

import type RecordingTranscriptPlayerPlugin from "./main";
import { shouldRestorePlaybackPosition } from "./playback-position";
import { getSubtitleCandidates } from "./subtitle-resolution";
import { TranscriptCue, countActiveCues, findActiveCue, parseSubtitleSource } from "./srt";
import { TranscriptMatch, findMatches } from "./transcript-search";

export const VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER = "recording-transcript-player-view";

export class RecordingTranscriptPlayerView extends FileView {
  private audioEl?: HTMLAudioElement;
  private activeCueEl?: HTMLElement;
  private autoScroll = true;
  private cleanupController?: AbortController;
  private cueElements = new Map<number, HTMLElement>();
  private cueRenders = new Map<number, CueRender>();
  private cues: TranscriptCue[] = [];
  private lastSavedAt = 0;
  private statusEl?: HTMLElement;
  private timeEl?: HTMLElement;
  private cueCountEl?: HTMLElement;
  private searchBarEl?: HTMLElement;
  private searchInputEl?: HTMLInputElement;
  private searchCounterEl?: HTMLElement;
  private searchMatches: TranscriptMatch[] = [];
  private currentMatchIndex = -1;

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

    this.buildSearchBar(shell);

    const transcriptEl = shell.createDiv({ cls: "rtp-transcript" });
    const transcriptResult = await this.loadTranscript(file);
    this.cues = transcriptResult.cues;
    this.renderTranscript(transcriptEl, transcriptResult);
    this.bindAudioEvents(file, autoScrollCheckbox);
    this.bindSearchKeyboardShortcuts();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    await this.saveCurrentPosition(file);
    this.cleanup();
    this.cues = [];
    this.cueElements.clear();
    this.cueRenders.clear();
    this.activeCueEl = undefined;
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.searchBarEl = undefined;
    this.searchInputEl = undefined;
    this.searchCounterEl = undefined;
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
    this.cueRenders.clear();
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
    result.cues.forEach((cue, cueIndex) => {
      const row = transcriptEl.createDiv({ cls: "rtp-cue" });
      const button = row.createEl("button", {
        cls: "rtp-timestamp",
        text: cue.timestampLabel,
        attr: { type: "button" }
      });
      const body = row.createDiv({ cls: "rtp-cue-body" });
      let speakerEl: HTMLElement | undefined;
      if (cue.speaker) {
        speakerEl = body.createDiv({ cls: "rtp-speaker", text: cue.speaker });
      }
      const textEl = body.createDiv({ cls: "rtp-text", text: cue.text });

      button.addEventListener("click", () => {
        if (this.audioEl) {
          this.audioEl.currentTime = cue.startSeconds;
          void this.audioEl.play();
        }
      });
      this.cueElements.set(cue.index, row);
      this.cueRenders.set(cueIndex, { cue, textEl, speakerEl });
    });
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

  private buildSearchBar(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "rtp-search-bar is-hidden" });
    const input = bar.createEl("input", {
      cls: "rtp-search-input",
      attr: { type: "text", placeholder: "Search transcript…", spellcheck: "false" }
    });
    const counter = bar.createSpan({ cls: "rtp-search-counter", text: "" });
    const prevBtn = bar.createEl("button", {
      cls: "rtp-search-nav",
      attr: { type: "button", "aria-label": "Previous match" }
    });
    prevBtn.setText("▲");
    const nextBtn = bar.createEl("button", {
      cls: "rtp-search-nav",
      attr: { type: "button", "aria-label": "Next match" }
    });
    nextBtn.setText("▼");
    const closeBtn = bar.createEl("button", {
      cls: "rtp-search-close",
      attr: { type: "button", "aria-label": "Close search" }
    });
    closeBtn.setText("✕");

    this.searchBarEl = bar;
    this.searchInputEl = input;
    this.searchCounterEl = counter;

    input.addEventListener("input", () => this.updateSearch(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.hideSearch();
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.navigateMatch(event.shiftKey ? -1 : 1);
      }
    });
    prevBtn.addEventListener("click", () => this.navigateMatch(-1));
    nextBtn.addEventListener("click", () => this.navigateMatch(1));
    closeBtn.addEventListener("click", () => this.hideSearch());
  }

  private bindSearchKeyboardShortcuts(): void {
    if (!this.cleanupController) {
      return;
    }
    const options = { signal: this.cleanupController.signal };
    this.contentEl.addEventListener(
      "keydown",
      (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
          event.preventDefault();
          this.showSearch();
        }
      },
      options
    );
  }

  private showSearch(): void {
    if (!this.searchBarEl || !this.searchInputEl) {
      return;
    }
    this.searchBarEl.removeClass("is-hidden");
    this.searchInputEl.focus();
    this.searchInputEl.select();
  }

  private hideSearch(): void {
    if (!this.searchBarEl || !this.searchInputEl) {
      return;
    }
    this.searchBarEl.addClass("is-hidden");
    this.searchInputEl.value = "";
    this.updateSearch("");
  }

  private updateSearch(query: string): void {
    this.searchMatches = findMatches(this.cues, query);
    this.currentMatchIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.applySearchHighlights();
    this.updateSearchCounter();
    this.scrollCurrentMatchIntoView();
  }

  private navigateMatch(direction: 1 | -1): void {
    if (this.searchMatches.length === 0) {
      return;
    }
    const total = this.searchMatches.length;
    this.currentMatchIndex = (this.currentMatchIndex + direction + total) % total;
    this.applySearchHighlights();
    this.updateSearchCounter();
    this.scrollCurrentMatchIntoView();
  }

  private applySearchHighlights(): void {
    const byCueField = new Map<string, { ranges: Range[]; currentOffset: number }>();
    this.searchMatches.forEach((match, globalIndex) => {
      const key = `${match.cueIndex}:${match.field}`;
      let entry = byCueField.get(key);
      if (!entry) {
        entry = { ranges: [], currentOffset: -1 };
        byCueField.set(key, entry);
      }
      if (globalIndex === this.currentMatchIndex) {
        entry.currentOffset = entry.ranges.length;
      }
      entry.ranges.push({ start: match.start, end: match.end });
    });

    this.cueRenders.forEach((render, cueIndex) => {
      const textEntry = byCueField.get(`${cueIndex}:text`);
      this.renderHighlightedText(
        render.textEl,
        render.cue.text,
        textEntry?.ranges ?? [],
        textEntry?.currentOffset ?? -1
      );
      if (render.speakerEl && render.cue.speaker) {
        const speakerEntry = byCueField.get(`${cueIndex}:speaker`);
        this.renderHighlightedText(
          render.speakerEl,
          render.cue.speaker,
          speakerEntry?.ranges ?? [],
          speakerEntry?.currentOffset ?? -1
        );
      }
    });
  }

  private renderHighlightedText(
    element: HTMLElement,
    source: string,
    ranges: Range[],
    currentRangeIndex: number
  ): void {
    element.empty();
    if (ranges.length === 0) {
      element.setText(source);
      return;
    }
    let cursor = 0;
    ranges.forEach((range, rangeIndex) => {
      if (range.start > cursor) {
        element.appendText(source.slice(cursor, range.start));
      }
      const span = element.createSpan({ cls: "rtp-match-highlight" });
      if (rangeIndex === currentRangeIndex) {
        span.addClass("is-current");
      }
      span.setText(source.slice(range.start, range.end));
      cursor = range.end;
    });
    if (cursor < source.length) {
      element.appendText(source.slice(cursor));
    }
  }

  private updateSearchCounter(): void {
    if (!this.searchCounterEl) {
      return;
    }
    const total = this.searchMatches.length;
    if (total === 0) {
      this.searchCounterEl.setText(this.searchInputEl?.value.trim() ? "0/0" : "");
    } else {
      this.searchCounterEl.setText(`${this.currentMatchIndex + 1}/${total}`);
    }
  }

  private scrollCurrentMatchIntoView(): void {
    if (this.currentMatchIndex < 0) {
      return;
    }
    const match = this.searchMatches[this.currentMatchIndex];
    const render = this.cueRenders.get(match.cueIndex);
    if (!render) {
      return;
    }
    const fieldEl = match.field === "speaker" ? render.speakerEl : render.textEl;
    const currentEl = fieldEl?.querySelector(".rtp-match-highlight.is-current");
    (currentEl ?? render.textEl).scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

interface CueRender {
  cue: TranscriptCue;
  textEl: HTMLElement;
  speakerEl?: HTMLElement;
}

interface Range {
  start: number;
  end: number;
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
