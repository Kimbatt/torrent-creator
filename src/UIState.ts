export const enum BlockSize {
    Auto,
    KB16,
    KB32,
    KB64,
    KB128,
    KB256,
    KB512,
    MB1,
    MB2,
    MB4,
    MB8,
    MB16,
}

export interface TorrentUIParameters {
    name: string;
    blockSize: BlockSize;
    isPrivate: boolean;
    setCreationDate: boolean;
    trackers: string;
    webSeeds: string;
    comment: string;
    source: string;
}
