import { Menu, Notice, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";

import { shouldAutoOpenRecordingWithTranscript, shouldFallbackToDefaultMediaView } from "./auto-open";
import { registerAudioExtensions } from "./extension-registration";
import { openRecordingInLeaf } from "./open-recording";
import { RecordingTranscriptPlayerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, RecordingTranscriptPlayerData, RecordingTranscriptPlayerSettings, normalizeSettings } from "./settings-model";
import { getSubtitleCandidates } from "./subtitle-resolution";
import { RecordingTranscriptPlayerView, VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER } from "./view";

export default class RecordingTranscriptPlayerPlugin extends Plugin {
  settings: RecordingTranscriptPlayerSettings = DEFAULT_SETTINGS;
  playbackPositions: RecordingTranscriptPlayerData["playbackPositions"] = {};
  private isAutoOpening = false;

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.registerView(
      VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER,
      (leaf: WorkspaceLeaf) => new RecordingTranscriptPlayerView(leaf, this)
    );
    registerAudioExtensions(
      this,
      this.settings.supportedAudioExtensions,
      VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER,
      (error) => console.warn("Recording Transcript Player could not register audio extensions.", error)
    );

    this.addCommand({
      id: "open-recording-with-transcript",
      name: "Open recording with transcript",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isSupportedAudioFile(file)) {
          return false;
        }

        if (!checking) {
          this.openRecording(file).catch((error) =>
            console.error("Recording Transcript Player: openRecording failed", error)
          );
        }
        return true;
      }
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        if (file instanceof TFile && this.isSupportedAudioFile(file)) {
          menu.addItem((item) => {
            item
              .setTitle("Open recording with transcript")
              .setIcon("file-audio")
              .onClick(() =>
                this.openRecording(file).catch((error) =>
                  console.error("Recording Transcript Player: openRecording failed", error)
                )
              );
          });
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file: TFile | null) => {
        this.maybeOpenMatchedRecordingInPluginView(file).catch((error) =>
          console.error("Recording Transcript Player: auto-open failed", error)
        );
      })
    );

    this.addSettingTab(new RecordingTranscriptPlayerSettingTab(this.app, this));
  }

  async openRecording(file: TFile): Promise<void> {
    if (!this.isSupportedAudioFile(file)) {
      new Notice("Recording Transcript Player only opens supported audio files.");
      return;
    }

    const leaf = this.app.workspace.getLeaf(true);
    await openRecordingInLeaf(leaf, file, VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER);
  }

  isSupportedAudioFile(file: TFile): boolean {
    return this.settings.supportedAudioExtensions.includes(file.extension.toLowerCase());
  }

  hasMatchingSubtitleFile(file: TFile): boolean {
    return getSubtitleCandidates(file.path, this.settings.subtitleExtensionPriority).some((candidate) => {
      const abstractFile = this.app.vault.getAbstractFileByPath(candidate);
      return abstractFile instanceof TFile;
    });
  }

  private async maybeOpenMatchedRecordingInPluginView(file: TFile | null): Promise<void> {
    if (!file) {
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      return;
    }

    const hasMatchingSubtitle = this.hasMatchingSubtitleFile(file);
    const currentViewType = leaf.view.getViewType();

    const shouldOpen = shouldAutoOpenRecordingWithTranscript({
      enabled: this.settings.openRecordingsInPluginViewWhenSubtitleExists,
      fallbackEnabled: this.settings.fallbackToDefaultMediaViewWhenNoSubtitle,
      fileExtension: file.extension,
      supportedAudioExtensions: this.settings.supportedAudioExtensions,
      hasMatchingSubtitle,
      currentViewType,
      pluginViewType: VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER,
      isAutoOpening: this.isAutoOpening
    });

    if (shouldOpen) {
      this.isAutoOpening = true;
      try {
        const replacementLeaf = this.app.workspace.getLeaf("tab");
        await openRecordingInLeaf(replacementLeaf, file, VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER);
        leaf.detach();
      } finally {
        this.isAutoOpening = false;
      }
      return;
    }

    const shouldFallback = shouldFallbackToDefaultMediaView({
      parentEnabled: this.settings.openRecordingsInPluginViewWhenSubtitleExists,
      fallbackEnabled: this.settings.fallbackToDefaultMediaViewWhenNoSubtitle,
      fileExtension: file.extension,
      supportedAudioExtensions: this.settings.supportedAudioExtensions,
      hasMatchingSubtitle,
      currentViewType,
      pluginViewType: VIEW_TYPE_RECORDING_TRANSCRIPT_PLAYER,
      isAutoOpening: this.isAutoOpening
    });

    if (!shouldFallback) {
      return;
    }

    this.isAutoOpening = true;
    try {
      const replacementLeaf = this.app.workspace.getLeaf("tab");
      await replacementLeaf.openFile(file, { active: true });
      leaf.detach();
    } finally {
      this.isAutoOpening = false;
    }
  }

  getPlaybackPosition(path: string): number | undefined {
    return this.playbackPositions[path]?.position;
  }

  async setPlaybackPosition(path: string, position: number): Promise<void> {
    if (!Number.isFinite(position) || position <= 0) {
      return;
    }

    this.playbackPositions[path] = {
      position,
      updatedAt: Date.now()
    };
    await this.savePluginData();
  }

  async loadPluginData(): Promise<void> {
    const data = (await this.loadData()) as Partial<RecordingTranscriptPlayerData> | null;
    this.settings = normalizeSettings(data?.settings);
    this.playbackPositions = data?.playbackPositions ?? {};
  }

  async savePluginData(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      playbackPositions: this.playbackPositions
    } satisfies RecordingTranscriptPlayerData);
  }
}
