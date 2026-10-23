import { KB, MB } from "./Util";

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

    MB32,
    MB64,
    MB128,
}

export const nonAutoBlockSizes = [
    BlockSize.KB16,
    BlockSize.KB32,
    BlockSize.KB64,
    BlockSize.KB128,
    BlockSize.KB256,
    BlockSize.KB512,
    BlockSize.MB1,
    BlockSize.MB2,
    BlockSize.MB4,
    BlockSize.MB8,
    BlockSize.MB16,
    BlockSize.MB32,
    BlockSize.MB64,
    BlockSize.MB128,
];

export function getAutoBlockSize(totalSize: number) {
    const targetBlockCount = 1200;
    let factor = Math.round(Math.log2(totalSize / targetBlockCount));
    factor = Math.max(factor, 14); // 2^14 = 16 kb (minimum block size)
    factor = Math.min(factor, 24); // 2^24 = 16 mb (maximum block size)
    // Technically the block size can be larger than 16mb, but don't select larger sizes with the `auto` size
    return 1 << factor;
}

export function getBlockSize(blockSize: BlockSize, totalSize: number): number {
    switch (blockSize) {
        case BlockSize.Auto:
            return getAutoBlockSize(totalSize);
        case BlockSize.KB16:
            return 16 * KB;
        case BlockSize.KB32:
            return 32 * KB;
        case BlockSize.KB64:
            return 64 * KB;
        case BlockSize.KB128:
            return 128 * KB;
        case BlockSize.KB256:
            return 256 * KB;
        case BlockSize.KB512:
            return 512 * KB;
        case BlockSize.MB1:
            return 1 * MB;
        case BlockSize.MB2:
            return 2 * MB;
        case BlockSize.MB4:
            return 4 * MB;
        case BlockSize.MB8:
            return 8 * MB;
        case BlockSize.MB16:
            return 16 * MB;
        case BlockSize.MB32:
            return 32 * MB;
        case BlockSize.MB64:
            return 64 * MB;
        case BlockSize.MB128:
            return 128 * MB;
    }
}
