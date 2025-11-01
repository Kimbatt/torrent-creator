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
        if (!trackersOverlayVisible) {
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

    let readingProgressText = $state("");
    let readingProgress = $state(0);
    let processingProgress = $state(0);

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
        pieces = null;
        lastValidInfoObject = null;

        if (downloadBlobUrl !== null) {
            URL.revokeObjectURL(downloadBlobUrl);
        }
        downloadBlobUrl = null;
    }

    $effect(() => {
        Track(selectedFileOrFolderInfo, torrentUIParameters.blockSize);
        resetCreationState();
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
        if (creationState === TorrentCreationState.InProgress) {
            ++creationId;
            resetCreationState();
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

        if (creationState === TorrentCreationState.NotStarted || pieces === null) {
            creationState = TorrentCreationState.InProgress;
            readingProgress = 0;
            processingProgress = 0;

            let totalBytesRead = 0;
            let totalBytesProcessed = 0;

            const isCancelled = () => currentCreationId !== creationId;

            const calculateHashesResult = (
                await calculateHashes(
                    selectedFileOrFolderInfo.fileList,
                    totalSize,
                    blockSize,
                    isCancelled,
                    numBytes => {
                        totalBytesRead += numBytes;
                        readingProgress = totalBytesRead / totalSize;
                    },
                    numBytes => {
                        totalBytesProcessed += numBytes;
                        processingProgress = totalBytesProcessed / totalSize;
                    },
                    filePath => {
                        readingProgressText = "Reading file: " + filePath;
                    },
                )
            ).getData();

            if (calculateHashesResult.isError) {
                errorText = calculateHashesResult.error;
                resetCreationState();
                return;
            }

            pieces = calculateHashesResult.result;

            readingProgress = 1;
            processingProgress = 1;

            readingProgressText = "Done";
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

    <div class="picker-buttons">
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

        {#if selectedFileOrFolderInfo !== null}
            <div style="font-size: 22px;">
                Selected {selectedFileOrFolderInfo.input.type === InputType.Folder ? "folder" : "file"}: {selectedFileOrFolderInfo.name}
                ({GetSizeStr(selectedFileOrFolderInfo.size)})
            </div>
        {/if}
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

    <div style="display: flex; flex-wrap: wrap; gap: 20px 200px;">
        <label style="font-size: 22px;">
            Piece size:
            <select
                style="width: 250px;"
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

        <label style="font-size: 22px;">
            Private torrent
            <input
                type="checkbox"
                disabled={disableInputs}
                style="transform: scale(2); background: white;"
                bind:checked={torrentUIParameters.isPrivate}
            />
        </label>
    </div>

    <label style="font-size: 22px; align-self: start;">
        Set creation date
        <input
            type="checkbox"
            disabled={disableInputs}
            style="transform: scale(2); background: white;"
            bind:checked={torrentUIParameters.setCreationDate}
        />
    </label>

    <div
        class="overlay"
        class:visible={trackersOverlayVisible}
    >
        <div class="trackers-list">
            <button
                style="position: absolute;"
                onclick={() => (trackersOverlayVisible = false)}
            >
                Close
            </button>
            <div style="align-self: center; font-size: 24px; margin-bottom: 20px;">
                Click on a tracker to add it to the list!
            </div>
            <div class="trackers-list-container">
                {#each builtinTrackers as tracker}
                    <button
                        class="trackers-list-element"
                        class:hidden={!tracker.visible}
                        onclick={() => {
                            torrentUIParameters.trackers += tracker.url + "\n";
                            tracker.visible = false;
                        }}
                    >
                        {tracker.url}
                    </button>
                {/each}
            </div>
            <div style="font-size: 20px;">
                Tracker list from
                <a href="https://github.com/ngosang/trackerslist/">https://github.com/ngosang/trackerslist/</a>
            </div>
        </div>
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

    {#if errorText !== null}
        <div style="font-size: 25px; color: #ff3d58; white-space: pre-line;">
            {errorText}
        </div>
    {/if}

    {#snippet renderProgressBar(text: string, progress: number, showPercentageText: boolean)}
        <div
            class="progress-bar-container"
            class:visible={creationState !== TorrentCreationState.NotStarted}
        >
            <div
                class="progressbar"
                style="background: #23b235; height: 100%; border-radius: 3px;"
                style:width={`${progress * 100}%`}
            ></div>
            <div
                style="position: absolute; bottom: 4px; font-size: 25px; padding-bottom: 2px; padding-left: 6px; text-shadow: 2px 2px 5px blue;"
            >
                {#if showPercentageText}
                    {`${text}: ${(progress * 100).toFixed(2)}%`}
                {:else}
                    {text}
                {/if}
            </div>
        </div>
    {/snippet}

    {@render renderProgressBar(readingProgressText, readingProgress, false)}
    {@render renderProgressBar(
        processingProgress === 1 ? "Done" : "Processing",
        processingProgress,
        processingProgress !== 1,
    )}

    <div style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 32px;">
        <button
            style="width: 600px; height: 100px; font-size: 50px; line-height: 80px;"
            onclick={createTorrent}
            disabled={!canCreateTorrent}
        >
            {createTorrentButtonText}
        </button>

        {#if infoHash !== null}
            <div class="info-hash-container">
                Info hash: <code class="info-hash-value">{infoHash}</code>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    $dark-background: #484848;
    $dark-border: 1px solid #8a8a8a;
    $placeholder-color: #a7a7a7;

    :global(body) {
        background: #323639;
        color: white;
        font-family: Sans-Serif;
        margin: 0px;
    }

    button {
        background-color: #146dff;
        border: none;
        border-radius: 5px;
        color: #ffffff;
        padding: 10px 15px 10px 15px;
        font-family: "Verdana";
        font-size: 24px;
        cursor: pointer;
        transition: background-color 0.15s linear;
        outline: none;

        &:hover {
            background-color: #54adff;
            cursor: pointer;
        }

        &:disabled {
            background-color: #77abff;
            cursor: not-allowed;
        }
    }

    textarea,
    input,
    select {
        color: white;
        background: $dark-background;
        border: $dark-border;
    }

    textarea {
        font-size: 22px;
        padding: 10px;
        resize: none;
        white-space: nowrap;
        font-family: Sans-Serif;
        line-height: 30px;

        &::placeholder {
            color: $placeholder-color;
        }
    }

    input[type="text"]::placeholder {
        color: $placeholder-color;
    }

    a {
        color: #32b2ff;
    }

    select {
        font-size: 22px;
        padding: 2px;
        border-radius: 4px;
    }

    .page {
        position: relative;
        margin: 20px;

        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .title {
        font-size: 32px;
    }

    .github-link {
        position: absolute;
        width: 32px;
        height: 32px;
        top: 0px;
        right: 0px;
    }

    .picker-buttons {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 20px;

        > button {
            width: 200px;
        }
    }

    .add-trackers-button {
        position: absolute;
        right: 8px;
        top: 8px;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;

        &.visible {
            visibility: visible;
            opacity: 1;
        }
    }

    .progress-bar-container {
        border: 2px solid #bcbcbc;
        border-radius: 5px;
        width: 100%;
        position: relative;

        visibility: hidden;
        opacity: 0;
        height: 0px;
        transition:
            visibility 0s 0.3s,
            opacity 0.3s linear,
            height 0.2s ease-in-out;

        &.visible {
            visibility: visible;
            opacity: 1;
            height: 40px;
            transition:
                opacity 0.3s linear,
                height 0.3s ease-in-out;
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

    .overlay {
        visibility: hidden;
        opacity: 0;
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 1;

        transition:
            opacity 0.15s linear,
            visibility 0.15s linear;

        &.visible {
            visibility: visible;
            opacity: 1;
        }
    }

    .trackers-list {
        position: relative;
        border: 2px solid #606060;
        border-radius: 10px;
        background: black;
        opacity: 1;
        padding: 5px;

        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
        margin: 20px;
    }

    .trackers-list-container {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 10px;
    }

    .trackers-list-element {
        font-size: 16px;
        padding: 8px 6px;
        white-space: normal;

        transition:
            opacity 0.15s ease-out,
            visibility 0.15s;

        &.hidden {
            visibility: hidden;
            opacity: 0;
        }
    }

    .input-fullwidth {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 22px;
        padding: 5px;
    }

    .info-hash-container {
        font-size: 22px;

        > .info-hash-value {
            background-color: #606060;
            padding: 6px 8px;
            border-radius: 6px;
        }
    }
</style>
