import type { BlockSize } from "./BlockSize";

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
