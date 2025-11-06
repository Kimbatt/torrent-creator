<script lang="ts">
    import { onMount } from "svelte";
    import GithubIcon from "./assets/github.svg";
    import { formatTextAreaLines, getLines, GetSizeStr, KB, MB, resizeTextArea, Track } from "./Util";
    import { BencodeBuffer, BencodeDict } from "./Bencode";
    import { InputType, loadFileOrFolder, type SelectedFileOrFolderInfo } from "./FileInput";
    import {
        assembleTorrentObject,
        calculateHashes,
        calculateInfoHash,
        getAutoBlockSize,
        getBlockSize,
        validateTorrentInput,
        type TorrentInfo,
    } from "./TorrentObject";
    import { BlockSize, type TorrentUIParameters } from "./UIState";
    import { workerPoolPromise } from "./Sha1";
    import CustomCheckbox from "./CustomCheckbox.svelte";

    const enum TorrentCreationState {
        NotStarted,
        InProgress,
        ReadyToDownload,
    }

    let fileSelectorInput: HTMLInputElement;
    let folderSelectorInput: HTMLInputElement;

    let selectedFileOrFolderInfo: SelectedFileOrFolderInfo | null = $state(null);

    function selectFileOrFolder(files: FileList | null) {
        selectedFileOrFolderInfo = loadFileOrFolder(files);

        if (selectedFileOrFolderInfo !== null) {
            torrentUIParameters.name = selectedFileOrFolderInfo.name;
        }
    }

    let creationState = $state(TorrentCreationState.NotStarted);
    let disableInputs = $derived.by(() => creationState === TorrentCreationState.InProgress);

    interface BuiltinTrackerUIParams {
        url: string;
        visible: boolean;
    }

    let builtinTrackers: BuiltinTrackerUIParams[] = $state([]);
    let trackersOverlayVisible = $state(false);
    onMount(async () => {
        const req = await fetch("https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt");
        const responseText = await req.text();

        builtinTrackers = getLines(responseText).map(url => ({
            url,
            visible: true,
        }));
    });

    $effect(() => {
        if (trackersOverlayVisible) {
            for (const tracker of builtinTrackers) {
                tracker.visible = true;
            }
        }
    });

    let downloadLink: HTMLAnchorElement;
    let trackersTextArea: HTMLTextAreaElement;
    let webSeedsTextArea: HTMLTextAreaElement;
    let commentTextArea: HTMLTextAreaElement;

    let torrentUIParameters: TorrentUIParameters = $state({
        name: "",
        blockSize: BlockSize.Auto,
        isPrivate: false,
        setCreationDate: true,
        trackers: "",
        webSeeds: "",
        comment: "",
        source: "",
    });
    let infoHash: string | null = $state(null);

    let progressText = $state("");
    let progressPercentage = $state(0);

    let errorText: string | null = $state(null);

    let canCreateTorrent = $derived(selectedFileOrFolderInfo !== null);

    let lastValidInfoObject: TorrentInfo | null = $state(null);
    let lastInfoHashCalculationIndex = 0;
    async function updateInfoHash() {
        const index = ++lastInfoHashCalculationIndex;

        if (lastValidInfoObject === null) {
            infoHash = null;
        } else {
            const newInfoHash = await calculateInfoHash(lastValidInfoObject);

            // Only update if the info hash didn't change during calculation
            if (lastInfoHashCalculationIndex === index) {
                infoHash = newInfoHash;
            }
        }
    }

    $effect(() => {
        if (lastValidInfoObject !== null) {
            // These parameters affect the info hash, and they don't require re-hashing the input file(s)
            // So if any of these values change, the info hash can be recalculated immediately
            lastValidInfoObject.name = torrentUIParameters.name;
            lastValidInfoObject.private = torrentUIParameters.isPrivate ? 1 : undefined;
            lastValidInfoObject.source = torrentUIParameters.source === "" ? undefined : torrentUIParameters.source;
        }

        updateInfoHash();
    });

    let pieces: Uint8Array | null = null;
    let downloadBlobUrl: string | null = null;

    function resetCreationState() {
        creationState = TorrentCreationState.NotStarted;
        progressPercentage = 0;
        progressText = "";
        pieces = null;
        lastValidInfoObject = null;

        if (downloadBlobUrl !== null) {
            URL.revokeObjectURL(downloadBlobUrl);
        }
        downloadBlobUrl = null;
    }

    resetCreationState();

    $effect(() => {
        Track(selectedFileOrFolderInfo, torrentUIParameters.blockSize);
        resetCreationState();
    });

    $effect(() => {
        // Hide error text if any of these parameters change
        Track(
            selectedFileOrFolderInfo,
            torrentUIParameters.blockSize,
            torrentUIParameters.name,
            torrentUIParameters.trackers,
            torrentUIParameters.webSeeds,
        );
        errorText = null;
    });

    let createTorrentButtonText = $derived.by((): string => {
        switch (creationState) {
            case TorrentCreationState.NotStarted:
                return "Create torrent";
            case TorrentCreationState.InProgress:
                return "Cancel";
            case TorrentCreationState.ReadyToDownload:
                return "Download torrent file";
        }
    });

    let autoCalculatedBlockSizeText: string | null = $derived.by(() => {
        if (selectedFileOrFolderInfo === null) {
            return null;
        }

        const size = getAutoBlockSize(selectedFileOrFolderInfo.size);
        return GetSizeStr(size);
    });

    let creationId = 0;

    async function createTorrent() {
        trackersOverlayVisible = false;

        const workerPool = await workerPoolPromise;

        if (creationState === TorrentCreationState.InProgress) {
            // Cancel
            ++creationId;
            resetCreationState();
            workerPool.setCreationId(creationId);
            return;
        }

        if (selectedFileOrFolderInfo === null) {
            // Shouldn't happen, button is disabled in this case
            return;
        }

        errorText = validateTorrentInput(torrentUIParameters).getError();
        if (errorText !== null) {
            return;
        }

        const totalSize = selectedFileOrFolderInfo.size;
        const blockSize = getBlockSize(torrentUIParameters.blockSize, totalSize);

        const currentCreationId = ++creationId;
        workerPool.setCreationId(currentCreationId);

        if (creationState === TorrentCreationState.NotStarted || pieces === null) {
            creationState = TorrentCreationState.InProgress;

            const isCancelled = () => currentCreationId !== creationId;

            let totalBytesRead = 0;
            let totalBytesProcessed = 0;

            const invTotalSize = 1 / totalSize;
            const updateProgress = () => {
                if (isCancelled()) {
                    return;
                }

                const readingProgress = totalBytesRead * invTotalSize;
                const processingProgress = totalBytesProcessed * invTotalSize;
                progressPercentage = (readingProgress + processingProgress) * 0.5;
            };

            updateProgress();

            const calculateHashesResult = (
                await calculateHashes(
                    selectedFileOrFolderInfo.fileList,
                    totalSize,
                    blockSize,
                    currentCreationId,
                    () => creationId,
                    numBytes => {
                        totalBytesRead += numBytes;
                        updateProgress();
                    },
                    numBytes => {
                        totalBytesProcessed += numBytes;
                        updateProgress();
                    },
                    filePath => {
                        progressText = filePath;
                    },
                )
            ).getData();

            if (calculateHashesResult.isError) {
                errorText = calculateHashesResult.error;
                resetCreationState();
                return;
            }

            pieces = calculateHashesResult.result;

            progressPercentage = 1;
            progressText = "Done";
        }

        // Create torrent object
        const torrentObjectCreationResult = assembleTorrentObject(
            torrentUIParameters,
            selectedFileOrFolderInfo,
            blockSize,
        ).getData();

        if (torrentObjectCreationResult.isError) {
            errorText = torrentObjectCreationResult.error;
            creationState = TorrentCreationState.NotStarted;
            return;
        }

        const torrentObject = torrentObjectCreationResult.result;
        torrentObject.info.pieces = pieces;
        lastValidInfoObject = torrentObject.info;

        // Bencode
        const bencodeBytes = new BencodeDict(torrentObject).encode(new BencodeBuffer()).getBytes();

        // Setup download
        const blob = new Blob([bencodeBytes], { type: "application/octet-stream" });

        if (downloadBlobUrl !== null) {
            URL.revokeObjectURL(downloadBlobUrl);
        }
        downloadBlobUrl = URL.createObjectURL(blob);
        downloadLink.href = downloadBlobUrl;

        if (creationState === TorrentCreationState.ReadyToDownload) {
            // Button was clicked and the download is ready, so just download
            downloadLink.download = torrentObject.info.name + ".torrent";
            downloadLink.click();
        }

        creationState = TorrentCreationState.ReadyToDownload;
    }
</script>

<div class="page">
    <a
        class="github-link"
        href="https://github.com/Kimbatt/torrent-creator"
    >
        <img src={GithubIcon} />
    </a>

    <a
        bind:this={downloadLink}
        style="display: none"
    ></a>

    <div class="title">Create torrent files online</div>

    <div
        class="pickers"
        class:nothing-selected={selectedFileOrFolderInfo === null}
    >
        <div class="buttons">
            <button
                disabled={disableInputs}
                onclick={() => fileSelectorInput.click()}
            >
                Select file
            </button>
            <button
                disabled={disableInputs}
                onclick={() => folderSelectorInput.click()}
            >
                Select folder
            </button>
        </div>

        <div class="info">
            {#if selectedFileOrFolderInfo !== null}
                <div class="wrap">
                    <div>
                        Selected {selectedFileOrFolderInfo.input.type === InputType.Folder ? "folder" : "file"}:
                    </div>
                    <div class="selected-name">
                        {selectedFileOrFolderInfo.name}
                    </div>
                </div>
                <div>
                    Size: {GetSizeStr(selectedFileOrFolderInfo.size)}
                </div>
            {:else}
                <div>Select a file or a folder to begin</div>
            {/if}
        </div>
    </div>

    <input
        type="file"
        style="display: none;"
        disabled={disableInputs}
        bind:this={fileSelectorInput}
        onclick={() => (fileSelectorInput.value = "")}
        onchange={() => selectFileOrFolder(fileSelectorInput.files)}
    />
    <input
        type="file"
        style="display: none;"
        disabled={disableInputs}
        bind:this={folderSelectorInput}
        webkitdirectory
        onclick={() => (folderSelectorInput.value = "")}
        onchange={() => selectFileOrFolder(folderSelectorInput.files)}
    />

    <input
        type="text"
        class="input-fullwidth"
        placeholder="Torrent name"
        disabled={disableInputs}
        bind:value={torrentUIParameters.name}
    />

    <div class="options-container">
        <label>
            <div class:disabled-text={disableInputs}>Piece size:</div>
            <select
                style="width: 220px;"
                disabled={disableInputs}
                bind:value={torrentUIParameters.blockSize}
            >
                <option value={BlockSize.Auto}>
                    Automatic{autoCalculatedBlockSizeText === null ? "" : ` (${autoCalculatedBlockSizeText})`}
                </option>
                <option value={BlockSize.KB16}>{GetSizeStr(16 * KB)}</option>
                <option value={BlockSize.KB32}>{GetSizeStr(32 * KB)}</option>
                <option value={BlockSize.KB64}>{GetSizeStr(64 * KB)}</option>
                <option value={BlockSize.KB128}>{GetSizeStr(128 * KB)}</option>
                <option value={BlockSize.KB256}>{GetSizeStr(256 * KB)}</option>
                <option value={BlockSize.KB512}>{GetSizeStr(512 * KB)}</option>
                <option value={BlockSize.MB1}>{GetSizeStr(1 * MB)}</option>
                <option value={BlockSize.MB2}>{GetSizeStr(2 * MB)}</option>
                <option value={BlockSize.MB4}>{GetSizeStr(4 * MB)}</option>
                <option value={BlockSize.MB8}>{GetSizeStr(8 * MB)}</option>
                <option value={BlockSize.MB16}>{GetSizeStr(16 * MB)}</option>
            </select>
        </label>

        <CustomCheckbox
            bind:checked={torrentUIParameters.isPrivate}
            text="Private torrent"
            disabled={disableInputs}
        />

        <CustomCheckbox
            bind:checked={torrentUIParameters.setCreationDate}
            text="Set creation date"
            disabled={disableInputs}
        />
    </div>

    <div style="position: relative; display: flex;">
        <textarea
            class="input-fullwidth"
            style="height: 130px; white-space: pre-wrap; flex-grow: 1;"
            placeholder="Trackers, separated by space or newline (optional)"
            disabled={disableInputs}
            bind:this={trackersTextArea}
            bind:value={torrentUIParameters.trackers}
            onchange={() => formatTextAreaLines(trackersTextArea, false)}
        ></textarea>

        <button
            class="add-trackers-button"
            class:visible={builtinTrackers.length !== 0}
            disabled={disableInputs}
            onclick={() => (trackersOverlayVisible = true)}
        >
            Add some trackers
        </button>

        <div
            class="trackers-overlay"
            class:visible={trackersOverlayVisible}
            onmouseleave={() => (trackersOverlayVisible = false)}
        >
            <div class="trackers-list">
                <div style="align-self: center;">Click on a tracker to add it to the list!</div>

                <div class="trackers-list-container">
                    {#each builtinTrackers as tracker}
                        <button
                            class="trackers-list-element"
                            class:visible={tracker.visible}
                            onclick={() => {
                                torrentUIParameters.trackers += tracker.url + "\n";
                                tracker.visible = false;
                            }}
                        >
                            {tracker.url}
                        </button>
                    {/each}
                </div>

                <div>
                    Tracker list from
                    <a href="https://github.com/ngosang/trackerslist/">https://github.com/ngosang/trackerslist/</a>
                </div>

                <button onclick={() => (trackersOverlayVisible = false)}>Close</button>
            </div>
        </div>
    </div>

    <textarea
        class="input-fullwidth"
        style="overflow: hidden;"
        placeholder="Web seeds, separated by space or newline (optional)"
        disabled={disableInputs}
        bind:this={webSeedsTextArea}
        bind:value={torrentUIParameters.webSeeds}
        oninput={() => resizeTextArea(webSeedsTextArea)}
        onchange={() => formatTextAreaLines(webSeedsTextArea)}
    ></textarea>

    <textarea
        class="input-fullwidth"
        style="overflow: hidden;"
        placeholder="Comment (optional)"
        disabled={disableInputs}
        bind:this={commentTextArea}
        bind:value={torrentUIParameters.comment}
        oninput={() => resizeTextArea(commentTextArea)}
    ></textarea>

    <input
        type="text"
        class="input-fullwidth"
        placeholder="Source (optional)"
        disabled={disableInputs}
        bind:value={torrentUIParameters.source}
    />

    <div
        class="progress-bar-container"
        class:not-started={creationState === TorrentCreationState.NotStarted}
    >
        <div
            class="bar"
            style:transform={`scaleX(${progressPercentage})`}
        ></div>
        <div class="text-container">
            <div class="progress-text">
                {progressText}
            </div>
            <div class="percentage-text">
                {`${(progressPercentage * 100).toFixed(2)}%`}
            </div>
        </div>
    </div>

    <div style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 32px;">
        <button
            class="create-torrent-button"
            onclick={createTorrent}
            disabled={!canCreateTorrent}
        >
            {createTorrentButtonText}
        </button>

        {#if errorText !== null}
            <div class="error-text">
                {errorText}
            </div>
        {:else if infoHash !== null}
            <div class="info-hash-container">
                <div>Info hash:</div>
                <div class="info-hash-value">{infoHash}</div>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    @use "./Constants.scss" as c;

    :global(body) {
        background: c.$color-background;
        color: c.$color-text;
        font-family: c.$default-font;
        font-size: c.$font-size-default;
        margin: 0px;
    }

    button,
    input,
    select,
    textarea {
        font-family: c.$default-font;
    }

    button {
        background-color: c.$color-primary;
        border: none;
        border-radius: c.$default-border-radius;
        color: c.$color-text;
        padding: 8px 16px;
        font-size: c.$font-size-default;
        cursor: pointer;
        transition:
            background-color c.$default-transition-linear,
            opacity 0.5s;
        outline: none;

        &:hover {
            background-color: c.$color-primary-hover;
            cursor: pointer;
        }

        &:disabled {
            background-color: c.$color-primary-disabled;
            cursor: not-allowed;
        }
    }

    textarea,
    input,
    select {
        color: c.$color-text;
        background-color: c.$color-input-background;
        border: c.$dark-border;
        border-radius: c.$default-border-radius;
        line-height: 30px;
        opacity: 1;

        transition:
            color c.$default-transition-linear,
            background-color c.$default-transition-linear,
            filter c.$default-transition-linear;

        &:disabled {
            color: c.$color-text-disabled;
            filter: brightness(0.8);
            background-color: c.$color-background-disabled;
            cursor: not-allowed;
        }
    }

    textarea {
        font-size: c.$font-size-default;
        padding: 10px;
        resize: none;
        white-space: nowrap;

        &::placeholder {
            color: c.$color-placeholder;
            font-style: italic;
        }
    }

    input[type="text"]::placeholder {
        color: c.$color-placeholder;
        font-style: italic;
    }

    a {
        color: #609dff;
    }

    select {
        font-size: c.$font-size-default;
        padding: 4px 2px;
        border-radius: c.$default-border-radius;
    }

    .page {
        position: relative;
        padding: 20px;
        margin: auto;

        display: flex;
        flex-direction: column;
        gap: 20px;

        max-width: 1200px;
    }

    .title {
        font-size: c.$font-size-title;
    }

    .github-link {
        position: absolute;
        width: 32px;
        height: 32px;
        top: 20px;
        right: 20px;
    }

    .disabled-text {
        color: c.$color-text-disabled;
    }

    .pickers {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 20px;

        > .buttons {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            gap: 12px;

            > button {
                min-width: 150px;
            }
        }

        > .info {
            display: flex;
            flex-direction: column;
            flex: 1 1 0px;
            gap: 8px;
            overflow: hidden;

            > .wrap {
                display: flex;
                flex-direction: row;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px 8px;

                > .selected-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    background-color: c.$color-info-backgroud;
                    padding: 4px 6px;
                    border-radius: c.$default-border-radius;
                }
            }
        }

        &.nothing-selected {
            > .buttons {
                flex-direction: row;
            }

            > .info > div {
                font-style: italic;
                color: c.$color-placeholder;
            }
        }
    }

    .options-container {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: start;
        gap: 20px 100px;
    }

    .add-trackers-button {
        position: absolute;
        right: 8px;
        top: 8px;
        visibility: hidden;
        opacity: 0;

        &.visible {
            visibility: visible;
            opacity: 1;
        }
    }

    .progress-bar-container {
        border: 2px solid #bcbcbc;
        border-radius: c.$default-border-radius;
        overflow: hidden;
        position: relative;

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;

        height: 40px;

        transition: opacity c.$default-transition-linear;

        &.not-started {
            opacity: 0.3;
        }

        > .bar {
            position: absolute;
            z-index: -1;
            background-color: #23b235;
            width: 100%;
            height: 100%;
            transform-origin: 0%;
        }

        > .text-container {
            gap: 50px;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;

            > .progress-text,
            > .percentage-text {
                font-size: c.$font-size-large;
                white-space: nowrap;
                text-shadow: 1px 1px 4px black;
                padding: 8px;
            }

            > .progress-text {
                overflow: hidden;
                text-overflow: ellipsis;
            }

            > .percentage-text {
                font-family: c.$default-font-percentage;
            }
        }
    }

    label {
        white-space: nowrap;

        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 20px;
    }

    .trackers-overlay {
        $offset: 10px;

        position: absolute;
        visibility: hidden;
        opacity: 0;
        position: absolute;
        right: -$offset;
        top: -100px;

        z-index: 1;

        padding: $offset;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: $offset;

        box-shadow: 0px 0px 40px black;

        display: flex;
        justify-content: center;
        align-items: center;

        transition:
            opacity c.$default-transition-linear,
            visibility c.$default-transition-linear;

        &.visible {
            visibility: visible;
            opacity: 1;
        }
    }

    .trackers-list {
        border: 2px solid #606060;
        border-radius: c.$default-border-radius;
        background-color: c.$color-background;
        padding: 5px;

        display: flex;
        flex-direction: column;

        gap: 24px;
        padding: 20px;

        box-sizing: border-box;
        max-height: 500px;
        min-width: 450px;

        > button {
            align-self: flex-end;
            min-width: 150px;
        }
    }

    .trackers-list-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        grid-auto-rows: min-content;
        gap: 10px;
        flex-shrink: 1;
        overflow-y: auto;
    }

    .trackers-list-element {
        font-size: c.$font-size-small;
        padding: 8px 4px;
        white-space: nowrap;
        overflow-x: hidden;
        text-overflow: ellipsis;

        visibility: hidden;
        opacity: 0;

        transition:
            opacity c.$default-transition-linear,
            visibility c.$default-transition-linear,
            background-color c.$default-transition-linear;

        background-color: c.$color-input-background;
        border: c.$dark-border;

        &:hover {
            background-color: c.$color-border;
        }

        &.visible {
            visibility: unset;
            opacity: 1;

            transition: background-color c.$default-transition-linear;
        }
    }

    .input-fullwidth {
        font-size: c.$font-size-default;
        padding: 5px;
    }

    .error-text {
        font-size: c.$font-size-large;
        color: #ff5050;
        white-space: pre-line;
    }

    .create-torrent-button {
        width: 400px;
        height: 70px;
        font-size: c.$font-size-title;
    }

    .info-hash-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        flex-grow: 1;
        gap: 8px;

        font-size: c.$font-size-default;

        > .info-hash-value {
            font-family: c.$default-font-monospace;
            background-color: c.$color-info-backgroud;
            padding: 6px;
            border-radius: c.$default-border-radius;
        }
    }
</style>
