import { App, PluginSettingTab, Setting } from "obsidian";

import type RecordingTranscriptPlayerPlugin from "./main";
import { DEFAULT_SETTINGS, parseExtensionList } from "./settings-model";

export class RecordingTranscriptPlayerSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: RecordingTranscriptPlayerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Recording Transcript Player" });

    new Setting(containerEl)
      .setName("Subtitle extension priority")
      .setDesc("Comma-separated extensions checked beside the audio file.")
      .addText((text) =>
        text
          .setPlaceholder("srt, vtt, json")
          .setValue(this.plugin.settings.subtitleExtensionPriority.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.subtitleExtensionPriority = parseExtensionList(
              value,
              DEFAULT_SETTINGS.subtitleExtensionPriority
            );
            await this.plugin.savePluginData();
          })
      );

    new Setting(containerEl)
      .setName("Supported audio extensions")
      .setDesc("Comma-separated audio extensions registered with Obsidian.")
      .addText((text) =>
        text
          .setPlaceholder("m4a, mp3, wav")
          .setValue(this.plugin.settings.supportedAudioExtensions.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.supportedAudioExtensions = parseExtensionList(
              value,
              DEFAULT_SETTINGS.supportedAudioExtensions
            );
            await this.plugin.savePluginData();
          })
      );

    new Setting(containerEl)
      .setName("Auto-scroll transcript")
      .setDesc("Keep the active subtitle visible during playback.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoScroll).onChange(async (value) => {
          this.plugin.settings.autoScroll = value;
          await this.plugin.savePluginData();
        })
      );

    new Setting(containerEl)
      .setName("Resume playback")
      .setDesc("Restore saved playback position unless it is near the end.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.resumePlayback).onChange(async (value) => {
          this.plugin.settings.resumePlayback = value;
          await this.plugin.savePluginData();
        })
      );

    new Setting(containerEl)
      .setName("Open matched recordings in plugin view")
      .setDesc("When an audio file has a matching subtitle file, open it in the transcript player automatically.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openRecordingsInPluginViewWhenSubtitleExists)
          .onChange(async (value) => {
            this.plugin.settings.openRecordingsInPluginViewWhenSubtitleExists = value;
            await this.plugin.savePluginData();
            this.display();
          })
      );

    const fallbackSetting = new Setting(containerEl)
      .setName("Fall back to default media view when no subtitle")
      .setDesc("If the audio file has no matching subtitle, open it in Obsidian's default media view instead of the plugin view.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fallbackToDefaultMediaViewWhenNoSubtitle)
          .setDisabled(!this.plugin.settings.openRecordingsInPluginViewWhenSubtitleExists)
          .onChange(async (value) => {
            this.plugin.settings.fallbackToDefaultMediaViewWhenNoSubtitle = value;
            await this.plugin.savePluginData();
          })
      );
    fallbackSetting.settingEl.addClass("rtp-sub-setting");
    if (!this.plugin.settings.openRecordingsInPluginViewWhenSubtitleExists) {
      fallbackSetting.settingEl.addClass("rtp-sub-setting-disabled");
    }

    new Setting(containerEl)
      .setName("Save position interval")
      .setDesc("Seconds between playback position saves.")
      .addText((text) =>
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.savePositionIntervalSeconds))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.savePositionIntervalSeconds = parsed;
              await this.plugin.savePluginData();
            }
          })
      );
  }
}
