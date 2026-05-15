export interface TranscriptLeaf {
  setViewState(viewState: {
    type: string;
    state: Record<string, unknown>;
    active: boolean;
  }): Promise<void>;
}

export interface VaultFileRef {
  path: string;
}

export async function openRecordingInLeaf(
  leaf: TranscriptLeaf,
  file: VaultFileRef,
  viewType: string
): Promise<void> {
  await leaf.setViewState({
    type: viewType,
    state: { file: file.path },
    active: true
  });
}
