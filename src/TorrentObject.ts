import { BencodeBuffer, BencodeDict } from "./Bencode";
import { InputType, type FileWithPath, type SelectedFileOrFolderInfo } from "./FileInput";
import { workerPoolPromise } from "./Sha1";
import { BlockSize, type TorrentUIParameters } from "./UIState";
import { getLines, KB, MB, Result } from "./Util";

export type TorrentFileInfo = {
    length: number;
    path: string[];
};

export type TorrentInfo = {
    name: string;
    private?: number;
    pieces: Uint8Array;
    "piece length": number;
    files?: TorrentFileInfo[];
    length?: number;
    source?: string;
};

export type TorrentObject = {
    info: TorrentInfo;
    announce?: string;
    "announce-list"?: string[][];
    "url-list"?: string[];
    "creation date"?: number;
    "created by"?: string;
    comment?: string;
};

export function validateTorrentInput(torrentUIParameters: TorrentUIParameters): Result<null, string> {
    if (torrentUIParameters.name.length === 0) {
        return Result.error("Torrent name cannot be empty");
    }

    if (torrentUIParameters.name.length > 255) {
        return Result.error("Torrent name cannot be longer than 255 characters");
    }

    if (torrentUIParameters.name.match(/[<>:\"\\\/\|\?\*]/)) {
        return Result.error("Torrent name cannot contain any of the following characters: < > : \\ / | ? *");
    }

    for (const tracker of getLines(torrentUIParameters.trackers)) {
        try {
            const url = new URL(tracker);

            if (!/\/announce\/?$/.test(url.pathname)) {
                return Result.error(
                    `Invalid tracker: \`${tracker}\` (URL must end with \`announce\` or \`announce/\`)`,
                );
            }
        } catch {
            return Result.error(`Invalid tracker: \`${tracker}\` (not a valid URL)`);
        }
    }

    for (const webSeed of getLines(torrentUIParameters.webSeeds)) {
        try {
            new URL(webSeed);
        } catch {
            return Result.error(`Invalid web seed: \`${webSeed}\` (not a valid URL)`);
        }
    }

    return Result.ok(null);
}

export function assembleTorrentObject(
    torrentUIParameters: TorrentUIParameters,
    selectedFileOrFolderInfo: SelectedFileOrFolderInfo | null,
    blockSize: number,
): Result<TorrentObject, string> {
    // Just in case
    const error = validateTorrentInput(torrentUIParameters).getError();
    if (error !== null) {
        return Result.error(error);
    }

    const infoObject: TorrentInfo = {
        name: torrentUIParameters.name,
        pieces: new Uint8Array(),
        "piece length": 0,
    };
    const torrentObject: TorrentObject = {
        info: infoObject,
    };

    const okTrackersList = getLines(torrentUIParameters.trackers);
    if (okTrackersList.length !== 0) {
        torrentObject.announce = okTrackersList[0];

        const announceList: string[][] = [];
        for (let i = 0; i < okTrackersList.length; ++i) {
            announceList.push([okTrackersList[i]]);
        }

        torrentObject["announce-list"] = announceList;
    }

    const webSeeds = getLines(torrentUIParameters.webSeeds);
    if (webSeeds.length !== 0) {
        torrentObject["url-list"] = webSeeds;
    }

    if (torrentUIParameters.comment !== "") {
        torrentObject["comment"] = torrentUIParameters.comment;
    }

    if (torrentUIParameters.setCreationDate) {
        torrentObject["creation date"] = (Date.now() / 1000) | 0;
    }

    torrentObject["created by"] = "kimbatt.github.io/torrent-creator";

    if (torrentUIParameters.isPrivate) {
        infoObject.private = 1;
    }

    infoObject["piece length"] = blockSize;

    if (torrentUIParameters.source !== "") {
        infoObject["source"] = torrentUIParameters.source;
    }

    if (selectedFileOrFolderInfo !== null) {
        if (selectedFileOrFolderInfo.input.type === InputType.File) {
            infoObject.length = selectedFileOrFolderInfo.input.file.size;
        } else {
            infoObject.files = selectedFileOrFolderInfo.fileList.map(({ path, file }) => ({
                length: file.size,
                path,
            }));
        }
    }

    return Result.ok(torrentObject);
}

export async function calculateHashes(
    inputFiles: FileWithPath[],
    totalSize: number,
    blockSize: number,
    creationId: number,
    getCurrentCreationId: () => number,
    updateReadingProgress: (progress: number) => void,
    updateProcessingProgress: (progress: number) => void,
    onReadingFileStarted: (filePath: string) => void,
): Promise<Result<Uint8Array, string | null>> {
    const isCancelled = () => creationId !== getCurrentCreationId();

    const totalBlockCount = Math.ceil(totalSize / blockSize);
    const piecesLocal = new Uint8Array(totalBlockCount * 20); // 20 bytes per sha-1 hash
    let pieceIndex = 0;

    const workerPool = await workerPoolPromise;

    const allWorkerPromises: Promise<void>[] = [];

    const memoryPool: Uint8Array[] = [];

    function dispatchSha1Worker(inputBytes: Uint8Array) {
        const inputLength = inputBytes.length;
        const numPieces = Math.ceil(inputLength / blockSize);

        const startPieceIndex = pieceIndex;
        pieceIndex += numPieces;

        const inputs: Uint8Array[] = [];
        for (let i = 0; i < numPieces; ++i) {
            const startByteIndex = i * blockSize;
            const endByteIndex = Math.min((i + 1) * blockSize, inputLength);

            const byteLength = endByteIndex - startByteIndex;
            const memoryBuffer = (memoryPool.pop() ?? new Uint8Array(blockSize)).subarray(0, byteLength);
            memoryBuffer.set(inputBytes.subarray(startByteIndex, endByteIndex));

            inputs.push(memoryBuffer);
        }

        async function calculateHashes() {
            const hashResult = await workerPool.computeHashes(inputs, creationId);
            if (hashResult === null) {
                // Cancelled
                return;
            }

            // Return reused buffers
            memoryPool.push(...hashResult.originalInputs);

            // Copy results into the pieces list
            const pieceByteIndex = startPieceIndex * 20;
            piecesLocal.set(hashResult.result, pieceByteIndex);

            updateProcessingProgress(inputLength);
        }

        allWorkerPromises.push(calculateHashes());
    }

    // Read 16MB chunks, even for lower block sizes
    const readBufferSize = 16 * MB;
    const readAccumulatorBuffer = new Uint8Array(readBufferSize);
    let readBufferIndex = 0;

    function onFileChunkRead(resultBytes: Uint8Array) {
        if (isCancelled()) {
            return;
        }

        updateReadingProgress(resultBytes.length);

        if (readBufferIndex + resultBytes.length >= readBufferSize) {
            // Block is full
            const remainingSize = readBufferSize - readBufferIndex;

            readAccumulatorBuffer.set(resultBytes.subarray(0, remainingSize), readBufferIndex);
            resultBytes = resultBytes.subarray(remainingSize);

            // Send to worker (no await here, all work will be awaited at the end)
            dispatchSha1Worker(readAccumulatorBuffer);

            readBufferIndex = 0;
        }

        // The rest of the file fits into the read buffer
        readAccumulatorBuffer.set(resultBytes, readBufferIndex);
        readBufferIndex += resultBytes.length;
    }

    const hasBYOB = File.prototype.stream !== undefined && typeof ReadableStreamBYOBReader !== undefined;

    for (const { path, file } of inputFiles) {
        if (file.size === 0) {
            // Files with 0 size don't contribute to the final hash
            continue;
        }

        const filePath = path.join("/");
        onReadingFileStarted(filePath);

        function getError() {
            return Result.error<Uint8Array, string>(
                `Error reading file: \`${filePath}\`
The file might be inaccessible, or might have been modified, moved, or deleted`,
            );
        }

        if (hasBYOB) {
            // Faster, stream-based version

            let byobBuffer = new ArrayBuffer(readBufferSize);

            const stream = file.stream();
            const reader = stream.getReader({ mode: "byob" });

            while (true) {
                let readResult: ReadableStreamReadResult<Uint8Array<ArrayBuffer>>;

                try {
                    // @ts-expect-error
                    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBReader/read
                    // An optional `min` parameter is available in new browsers, which requests at least N bytes to be read
                    // But since this is very new, the type definitions are not updated yet
                    // Once they are updated, this comment can be removed
                    readResult = await reader.read(new Uint8Array(byobBuffer), { min: readBufferSize });
                } catch (_ex) {
                    return getError();
                }

                if (isCancelled()) {
                    return Result.error(null);
                }

                if (readResult.value !== undefined) {
                    byobBuffer = readResult.value.buffer;
                    onFileChunkRead(readResult.value);
                }

                if (readResult.done) {
                    break;
                }
            }
        } else {
            // "Slower" version, each chunk is allocated separately

            const reader = new FileReader();

            let resolver = () => {};
            let onError = () => {};
            reader.onload = () => {
                const result = reader.result;
                if (!(result instanceof ArrayBuffer)) {
                    // Shouldn't happen
                    return;
                }

                onFileChunkRead(new Uint8Array(result));
                resolver();
            };

            reader.onerror = onError;

            const numReadsForCurrentFile = Math.ceil(file.size / readBufferSize);
            for (let i = 0; i < numReadsForCurrentFile; ++i) {
                const startIndex = i * readBufferSize;
                const endIndex = Math.min((i + 1) * readBufferSize, file.size);

                try {
                    await new Promise<void>((resolve, reject) => {
                        resolver = resolve;
                        onError = reject;
                        reader.readAsArrayBuffer(file.slice(startIndex, endIndex));
                    });
                } catch (_ex) {
                    return getError();
                }

                if (isCancelled()) {
                    return Result.error(null);
                }
            }
        }
    }

    // All files read, calculate hash of the remaining bytes
    if (readBufferIndex !== 0) {
        dispatchSha1Worker(readAccumulatorBuffer.subarray(0, readBufferIndex));
    }

    if (isCancelled()) {
        return Result.error(null);
    }

    await Promise.all(allWorkerPromises);

    if (isCancelled()) {
        return Result.error(null);
    }

    return Result.ok(piecesLocal);
}

export async function calculateInfoHash(infoObject: TorrentInfo) {
    const bencodeBytes = new BencodeDict(infoObject).encode(new BencodeBuffer()).getBytes();

    const workerPool = await workerPoolPromise;
    const hashResult = await workerPool.computeHashes([bencodeBytes], null);

    if (hashResult === null) {
        // Shouldn't happen, this is not cancelable
        throw Error("Calculation was cancelled");
    }

    return [...hashResult.result].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function getAutoBlockSize(totalSize: number) {
    const targetBlockCount = 1200;
    let factor = Math.round(Math.log2(totalSize / targetBlockCount));
    factor = Math.max(factor, 14); // 2^14 = 16 kb (minimum block size)
    factor = Math.min(factor, 24); // 2^24 = 16 mb (maximum block size)
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
    }
}
