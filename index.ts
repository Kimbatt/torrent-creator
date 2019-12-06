
let folderSelectionEnabled = false;


if (typeof WebAssembly === "undefined")
    document.getElementById("no_wasm_warning")!.style.display = "";

if ((<any>document.getElementById("folderchooser")).webkitdirectory === undefined)
{
    document.getElementById("no_folder_warning")!.style.display = "block";
    (<HTMLButtonElement>document.getElementById("folderchooserbutton")).disabled = true;
}
else
    folderSelectionEnabled = true;

const favicon = document.createElement("link");
favicon.rel = "shortcut icon";
favicon.type = "image/png";
favicon.href = "data:image/png;base64,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";

document.getElementsByTagName("head")[0].appendChild(favicon);

window.addEventListener("load", function()
{
    const request = new XMLHttpRequest();
    request.onload = function(ev)
    {
        if (ev.target === null)
            return;

        if (this.readyState !== 4 || (this.status !== 200 && this.status !== 0))
            return;
        
        const trackerList = this.responseText.trim().split(/\s+/);

        const trackerButtonContainer = <HTMLDivElement>document.getElementById("tracker_button_container");
        const trackersTextarea = <HTMLTextAreaElement>document.getElementById("torrent_trackers");
        
        for (let i = 0; i < trackerList.length; ++i)
        {
            const currentTracker = trackerList[i];
            const currentButton = document.createElement("button");
            currentButton.className = "trackers-list-element";
            currentButton.textContent = currentTracker;
            currentButton.onclick = function()
            {
                currentButton.classList.add("tracker-list-element-hidden");
                trackersTextarea.value += currentTracker + "\n";
            };
            
            trackerButtonContainer.appendChild(currentButton);
        }
        
        const button = <HTMLButtonElement>document.getElementById("tracker_add_button");
        button.style.visibility = "visible";
        button.style.opacity = "1";
    };
    
    request.open("GET", "https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt");
    request.send();
});

function ResizeTextarea(element: HTMLElement)
{
    element.style.height = "auto";
    element.style.height = (element.scrollHeight - 10) + "px";
}

function GetSizeStr(size: number)
{
    if (size < 1024)
        return size + " bytes";
    
    if (size < 1048576)
        return ((size / 1024) | 0) + " kB";
    
    if (size < 1073741824)
        return ((size / 1048576) | 0) + " MB";
    
    return (size / 1073741824).toFixed(2) + " GB";
}

let allFiles: File[] | null = [];
let singleFile: File | null = null;
let totalSize: number;

function FolderSelected(files: FileList)
{
    const folderName = (<string>((<any>files[0]).webkitRelativePath)).split("/")[0];
    (<HTMLInputElement>document.getElementById("torrent_name")).value = folderName;
    
    allFiles = [];
    totalSize = 0;
    for (let i = 0; i < files.length; ++i)
    {
        allFiles.push(files[i]);
        totalSize += files[i].size;
    }
    
    document.getElementById("selected_file_info")!.textContent = "Selected folder: " + folderName + " (" + GetSizeStr(totalSize) + ")";
    singleFile = null;
    (<HTMLButtonElement>document.getElementById("create_torrent_button")).disabled = false;
    
    ResetCreateButton();
}

function FileSelected(files: FileList)
{
    singleFile = files[0];
    const fileName = singleFile.name;
    totalSize = singleFile.size;
    (<HTMLInputElement>document.getElementById("torrent_name")).value = fileName;
    document.getElementById("selected_file_info")!.textContent = "Selected file: " + fileName + " (" + GetSizeStr(totalSize) + ")";
    allFiles = null;
    (<HTMLButtonElement>document.getElementById("create_torrent_button")).disabled = false;
    
    ResetCreateButton();
}

let torrentChanged = false;
function TorrentParamsChanged(type: string)
{
    switch (type)
    {
        case "blocksize":
            ResetCreateButton();
            return;
        default:
            break;
    }
    
    torrentChanged = true;
}

let trackersOverlayVisible = false;
function ShowTrackers(show: boolean)
{
    if (show === trackersOverlayVisible)
        return;
    
    trackersOverlayVisible = show;
    
    if (show)
    {
        const buttonContainer = document.getElementById("tracker_button_container")!.children;
        for (let i = 0; i < buttonContainer.length; ++i)
        {
            if (buttonContainer[i].nodeType === 1)
                buttonContainer[i].classList.remove("tracker-list-element-hidden");
        }
    }
    
    const overlay = document.getElementById("trackers_list_overlay")!;
    overlay.style.transition = show ? "visibility 0s, opacity 0.15s ease-out" : "visibility 0s 0.15s, opacity 0.15s ease-in";
    overlay.style.visibility = show ? "visible" : "hidden";
    overlay.style.opacity = show ? "1" : "0";
}

window.addEventListener("keydown", function(e)
{
    if (e.code === "Escape")
        ShowTrackers(false);
});

interface TorrentFileInfo
{
    length: number;
    path: string[];
}

interface TorrentInfo
{
    name: string;
    private?: number;
    pieces: number[] | string;
    "piece length": number;
    files?: TorrentFileInfo[];
    length: number;
    source?: string;
}

interface TorrentObject
{
    info: TorrentInfo | null;
    announce?: string;
    "announce-list"?: string[][];
    "creation date"?: number;
    "created by"?: string;
    comment?: string;
}

let creationInProgress = false;
let creationFinished = false;
let blockSize = 262144;
let torrentObject: TorrentObject | null = null;
function SetTorrentData()
{
    const errorTextDiv = document.getElementById("error_text")!;
    const torrentName = (<HTMLInputElement>document.getElementById("torrent_name")).value.trim();
    if (torrentName === "")
    {
        errorTextDiv.textContent = "Torrent name must not be empty";
        errorTextDiv.style.display = "";
        return false;
    }
    
    if (torrentName.match(/[<>:\"\\\/\|\?\*]/))
    {
        errorTextDiv.innerHTML = "Torrent name cannot contain any of the following characters: < > : \\ / | ? *";
        errorTextDiv.style.display = "";
        return false;
    }
    
    if (torrentName.length > 255)
    {
        errorTextDiv.innerHTML = "Torrent name cannot be longer than 255 characters";
        errorTextDiv.style.display = "";
        return false;
    }
    
    const trackers = (<HTMLTextAreaElement>document.getElementById("torrent_trackers")).value.split("\n");
    const okTrackers: { [key: string]: boolean } = {};
    for (let i = 0; i < trackers.length; ++i)
    {
        const current = trackers[i].trim();
        if (current === "")
            continue;
        
        if (current.match(/.+:\/\/([a-z0-9-]+\.)*([a-z0-9-]+):\d+((\/.*)\/announce)?/))
            okTrackers[current] = true;
        else
        {
            errorTextDiv.innerHTML = "Invalid tracker: " + current;
            errorTextDiv.style.display = "block";
            return false;
        }
    }
    
    const infoObject: TorrentInfo = (torrentObject && torrentObject["info"]) || { name: "", pieces: "", "piece length": 0, length: 0 };
    torrentObject = { "info": infoObject };

    const okTrackersList = Object.keys(okTrackers);
    if (okTrackersList.length !== 0)
    {
        torrentObject["announce"] = okTrackersList[0];
        const announceList: string[][] = [];
        for (let i = 0; i < okTrackersList.length; ++i)
            announceList.push([okTrackersList[i]]);
        
        torrentObject["announce-list"] = announceList;
    }
    
    const comment = (<HTMLTextAreaElement>document.getElementById("torrent_comment")).value;
    if (comment !== "")
        torrentObject["comment"] = comment;
    
    if ((<HTMLInputElement>document.getElementById("torrent_creation_date")).checked)
        torrentObject["creation date"] = (Date.now() / 1000) | 0;
    
    torrentObject["created by"] = "kimbatt.github.io/torrent-creator";
    
    if ((<HTMLInputElement>document.getElementById("torrent_is_private")).checked)
        infoObject["private"] = 1;
    
    infoObject["name"] = torrentName;
    const blockSizeComboBox = <HTMLSelectElement>document.getElementById("torrent_block_size");
    blockSize = Number(blockSizeComboBox.options[blockSizeComboBox.selectedIndex].value);
    if (blockSize === 0 || isNaN(blockSize))
    {
        let factor = Math.round(Math.log(totalSize / 1200) / Math.log(2));
        
        if (factor < 14)
            factor = 14;
        else if (factor > 24)
            factor = 24;
        
        blockSize = 1 << factor;
    }
    
    infoObject["piece length"] = blockSize;
    
    const source = (<HTMLInputElement>document.getElementById("torrent_source")).value;
    if (source !== "")
        infoObject["source"] = source;
    
    errorTextDiv.style.display = "none";
    return true;
}

function CreateTorrent()
{
    if (creationInProgress)
    {
        Cancel();
        return;
    }
    
    if (!SetTorrentData() || !torrentObject)
        return;
    
    torrentChanged = false;
    creationInProgress = true;
    document.getElementById("progressbar_container")!.className = "progress-bar-visible";
    document.getElementById("create_torrent_button")!.textContent = "Cancel";
    
    DisableElements(true);
    
    //if (wasmEnabled)
    //    sharedMemoryBuffer.set(new Uint8Array(16777216), 0);
    
    if (singleFile)
        CreateFromFile(torrentObject);
    else if (allFiles)
        CreateFromFolder(torrentObject);
}

function ResetCreateButton()
{
    if (!creationFinished)
        return;
    
    creationFinished = false;
    torrentChanged = false;
    torrentObject = null;
    
    const button = <HTMLButtonElement>document.getElementById("create_torrent_button");
    button.onclick = CreateTorrent;
    Cancel();
}

let blobUrl: string;
function Finished()
{
    creationFinished = true;

    if (!torrentObject || !torrentObject.info)
        return;
    
    const pieceBytes = <number[]>torrentObject.info["pieces"];
    let pieceStr = "";
    for (let i = 0; i < pieceBytes.length; ++i)
        pieceStr += String.fromCharCode(pieceBytes[i]);
    
    torrentObject.info["pieces"] = pieceStr;
    
    let blob = new Blob();

    function UpdateBlob()
    {
        if (torrentObject)
            blob = new Blob([new Uint8Array(Bencode.EncodeToBytes(torrentObject))], { type: "application/octet-stream" });
    }

    UpdateBlob();

    const button = <HTMLButtonElement>document.getElementById("create_torrent_button");
    button.textContent = "Download torrent file";
    if (window.navigator.msSaveOrOpenBlob)
    {
        button.onclick = function()
        {
            if (torrentChanged)
            {
                if (!SetTorrentData())
                    return;

                UpdateBlob();
            }
            
            if (torrentObject && torrentObject.info)
                window.navigator.msSaveOrOpenBlob(blob, torrentObject.info.name + ".torrent");
        };
    }
    else
    {
        const a = <HTMLAnchorElement>document.getElementById("download_link");
        a.download = torrentObject.info.name + ".torrent";
        window.URL.revokeObjectURL(blobUrl);
        blobUrl = window.URL.createObjectURL(blob);
        a.href = blobUrl;
        button.onclick = function()
        {
            if (torrentChanged)
            {
                if (!SetTorrentData() || !torrentObject || !torrentObject.info)
                    return;
                
                UpdateBlob();
                a.download = torrentObject.info.name + ".torrent";
                window.URL.revokeObjectURL(blobUrl);
                blobUrl = window.URL.createObjectURL(blob);
                a.href = blobUrl;
            }
            
            a.click();
        };
    }
    
    document.getElementById("progressbar_text")!.textContent = "Done";
    creationInProgress = false;
    DisableElements(false);
}

function Failed(fileName: string | null)
{
    const errorTextDiv = document.getElementById("error_text")!;
    errorTextDiv.textContent = fileName ? ("Failed to read file: " + fileName) : "Error reading file";
    errorTextDiv.style.display = "block";

    const progressBar = document.getElementById("progressbar")!;
    progressBar.style.display = "none";
    progressBar.style.width = "0%";
    
    Cancel();
}

function Cancel()
{
    creationInProgress = false;
    document.getElementById("create_torrent_button")!.textContent = "Create torrent";
    document.getElementById("progressbar_container")!.className = "progress-bar-hidden";
    document.getElementById("progressbar_text")!.textContent = "";
    document.getElementById("progressbar")!.style.width = "0%";
    DisableElements(false);
}

function DisableElements(disable: boolean)
{
    function DisableInternal(elementName: string, isDisabled: boolean)
    {
        (<any>document.getElementById(elementName)).disabled = isDisabled;
    }

    DisableInternal("torrent_name", disable);
    DisableInternal("torrent_block_size", disable);
    DisableInternal("torrent_is_private", disable);
    DisableInternal("torrent_creation_date", disable);
    DisableInternal("torrent_trackers", disable);
    DisableInternal("torrent_comment", disable);
    DisableInternal("torrent_source", disable);
    DisableInternal("filechooserbutton", disable);
    DisableInternal("folderchooserbutton", !folderSelectionEnabled || disable);
    DisableInternal("tracker_add_button", disable);
}

function CreateFromFile(obj: TorrentObject)
{
    if (!singleFile || !obj.info)
        return;

    const progressBarStyle = document.getElementById("progressbar")!.style;
    const infoObject = obj.info;
    const chunkSize = infoObject["piece length"];

    const file = singleFile;
    const fileSize = file.size;
    const readChunkSize = 16777216;
    const maxChunkCount = Math.ceil(fileSize / readChunkSize);
    const blocksPerChunk = readChunkSize / blockSize;
    const maxBlockCount = Math.ceil(fileSize / blockSize);
    const pieces = new Uint8Array(20 * maxBlockCount);
    infoObject["length"] = fileSize;
    let bytesReadSoFar = 0;
    let readStartIndex = 0;

    document.getElementById("progressbar_text")!.textContent = "Reading file: " + file.name;

    const fr = new FileReader();

    let currentWorkerCount = 0;
    function reader()
    {
        if (!creationInProgress)
            return;

        if (currentWorkerCount === maxWorkerCount)
        {
            waitingForWorkers = true
            return;
        }

        fr.readAsArrayBuffer(file.slice(readStartIndex, readStartIndex + readChunkSize));
        readStartIndex += readChunkSize;
    }

    let chunkIndex = 0;
    let waitingForWorkers = false;
    fr.onloadend = async function(ev)
    {
        if (!ev.target || !(ev.target.result instanceof ArrayBuffer))
            return;

        ++currentWorkerCount;
        const currentChunkIndex = chunkIndex++;
        const bytes = new Uint8Array(ev.target.result);
        bytesReadSoFar += bytes.length;
        progressBarStyle.width = (bytesReadSoFar / fileSize * 100) + "%";

        sha1({ data: bytes, blockSize: chunkSize, readChunkSize: readChunkSize }).then(result =>
        {
            pieces.set(result, currentChunkIndex * blocksPerChunk * 20);
            --currentWorkerCount;

            if (chunkIndex === maxChunkCount && currentWorkerCount === 0)
            {
                // everything finished
                infoObject["pieces"] = Array.from(pieces);
                Finished();
            }
            else if (waitingForWorkers)
            {
                waitingForWorkers = false;
                reader();
            }
        });

        if (chunkIndex !== maxChunkCount)
            reader();
    };

    fr.onerror = function()
    {
        Failed(singleFile && singleFile.name);
    };

    reader();
}

function CreateFromFolder(obj: TorrentObject)
{
    if (!allFiles || !obj.info)
        return;

    const progressBarStyle = document.getElementById("progressbar")!.style;
    const infoObject = obj.info;
    const chunkSize = infoObject["piece length"];
    let bytesReadSoFar = 0;
    const readChunkSize = 16777216;
    let currentChunk = new Uint8Array(readChunkSize);
    let currentChunkDataIndex = 0;
    let chunkIndex = 0;
    const blocksPerChunk = readChunkSize / blockSize;

    let totalSize = 0;
    const fileInfos: TorrentFileInfo[] = [];
    for (let i = 0; i < allFiles.length; ++i)
    {
        const currentFileInfo = allFiles[i];
        const currentFileSize = currentFileInfo.size;
        totalSize += currentFileSize;
        fileInfos.push(
        {
            "length" : currentFileSize,
            "path": (<string>(<any>currentFileInfo).webkitRelativePath).split("/").slice(1)
        });
    }

    const blockCount = Math.ceil(totalSize / chunkSize);
    const pieces = new Uint8Array(blockCount * 20);

    infoObject["files"] = fileInfos;

    let fileIndex = 0;
    const files = allFiles;
    let currentFile = files[0];

    const progressBarText = document.getElementById("progressbar_text")!;

    let readStartIndex = 0;
    let fileSize = currentFile.size;
    //const buffer = new Uint8Array(chunkSize);
    //let bufferIndex = 0;

    const fr = new FileReader();

    let currentWorkerCount = 0;
    function reader()
    {
        if (!creationInProgress)
            return;

        if (currentWorkerCount === maxWorkerCount)
        {
            waitingForWorkers = true
            return;
        }
        
        fr.readAsArrayBuffer(currentFile.slice(readStartIndex, readStartIndex + readChunkSize));
        readStartIndex += readChunkSize;
    }

    let waitingForWorkers = false;
    fr.onloadend = async function(ev)
    {
        if (!ev.target || !(ev.target.result instanceof ArrayBuffer))
            return;

        const bytes = new Uint8Array(ev.target.result);
        bytesReadSoFar += bytes.length;
        progressBarStyle.width = (bytesReadSoFar / totalSize * 100) + "%";

        if (currentChunkDataIndex + bytes.length >= readChunkSize)
        {
            // data doesn't fit in the current buffer, so fill the rest and create a new one
            const byteIndex = readChunkSize - currentChunkDataIndex;
            currentChunk.set(bytes.subarray(0, byteIndex), currentChunkDataIndex);
            const localChunk = currentChunk;
            currentChunk = new Uint8Array(readChunkSize);

            const currentChunkIndex = chunkIndex++;

            ++currentWorkerCount;
            sha1({ data: localChunk, blockSize: chunkSize, readChunkSize: readChunkSize }).then(result =>
            {
                pieces.set(result, currentChunkIndex * blocksPerChunk * 20);
                --currentWorkerCount;

                if (waitingForWorkers)
                {
                    waitingForWorkers = false;
                    reader();
                }

            });

            // set the remaining data
            currentChunk.set(bytes.subarray(byteIndex), 0);
            currentChunkDataIndex = bytes.length - byteIndex;
        }
        else
        {
            // just add to the buffer
            currentChunk.set(bytes, currentChunkDataIndex);
            currentChunkDataIndex += bytes.length;
        }

        if (readStartIndex < fileSize)
        {
            // current file is not finished yet
            reader();
        }
        else
        {
            // current file is finished, check if we have any more files left
            ++fileIndex;

            if (fileIndex === files.length)
            {
                // all files are processed, calculate the hash of the current buffer data
                if (currentChunkDataIndex !== 0)
                {
                    sha1({ data: currentChunk, blockSize: chunkSize, readChunkSize: currentChunkDataIndex }).then(result =>
                    {
                        pieces.set(result, chunkIndex * blocksPerChunk * 20);

                        infoObject["pieces"] = Array.from(pieces);
                        Finished();
                    });
                }
                else
                {
                    infoObject["pieces"] = Array.from(pieces);
                    Finished();
                }
            }
            else
            {
                // some files are still left
                currentFile = files[fileIndex];
                fileSize = currentFile.size;
                readStartIndex = 0;
                progressBarText.textContent = "Reading file: " + currentFile.name;
                reader();
            }
        }
    };

    fr.onerror = function()
    {
        Failed(currentFile.name);
    };

    progressBarText.innerHTML = "Reading file: " + currentFile.name;
    reader();
}

// bencode

function toUTF8Array(str: string)
{
    const utf8 = [];
    for (let i = 0; i < str.length; ++i)
    {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80)
            utf8.push(charcode);
        else if (charcode < 0x800)
            utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        else if (charcode < 0xd800 || charcode >= 0xe000)
            utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        else
        {
            ++i;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
    }

    return utf8;
}

function stringByteCount(str: string)
{
    let count = 0;
    for (let i = 0; i < str.length; ++i)
    {
        const charcode = str.charCodeAt(i);
        if (charcode < 0x80)
            ++count;
        else if (charcode < 0x800)
            count += 2;
        else if (charcode < 0xd800 || charcode >= 0xe000)
            count += 3;
        else
        {
            ++i;
            count += 4;
        }
    }
    
    return count;
}

function toByteArray(str: string)
{
    const ret = [];
    for (let i = 0; i < str.length; ++i)
        ret.push(str.charCodeAt(i));
    
    return ret;
}

class BencodeObject
{
    encode(_array: number[]) {}

    getBencodeObject(obj: any)
    {
        if (obj === null || obj === undefined)
            return null;

        switch (typeof obj)
        {
            case "number":
                return new BencodeInt(obj);
            case "string":
                return new BencodeString(obj);
            case "object":
            {
                if (Array.isArray(obj))
                    return new BencodeList(obj);
                else
                    return new BencodeDict(obj);
            }
        }

        return null;
    }
}

class BencodeDict extends BencodeObject
{
    private data: { [key: string]: BencodeObject };

    constructor(obj: { [key: string]: any })
    {
        super();
        this.data = {};

        for (let key in obj)
        {
            const bencodeObj = this.getBencodeObject(obj[key]);

            if (bencodeObj)
                this.data[key] = bencodeObj;
        }
    }

    encodeBinaryString(array: number[], str: string)
    {
        const bytesCount = str.length;
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        const strBytes = toByteArray(str);
        
        for (let i = 0; i < strBytes.length; ++i)
            array.push(strBytes[i]);
    }

    encode(array: number[])
    {
        array.push("d".charCodeAt(0));

        const sortedKeys = Object.keys(this.data).sort();
        
        for (let i = 0; i < sortedKeys.length; ++i)
        {
            const currentKey = sortedKeys[i];
            const currentObject = this.data[currentKey];

            const bencodedKeyObject = this.getBencodeObject(currentKey);
            if (bencodedKeyObject)
            {
                bencodedKeyObject.encode(array);

                if (currentKey === "pieces" && currentObject instanceof BencodeString)
                    this.encodeBinaryString(array, currentObject.value);
                else
                    currentObject.encode(array);
            }
        }

        array.push("e".charCodeAt(0));
    }
}

class BencodeList extends BencodeObject
{
    private data: BencodeObject[];

    constructor(list: any[])
    {
        super();
        this.data = [];

        for (let i = 0; i < list.length; ++i)
        {
            const bencodeObj = this.getBencodeObject(list[i]);

            if (bencodeObj)
                this.data.push(bencodeObj);
        }
    }

    encode(array: number[])
    {
        array.push("l".charCodeAt(0));
        
        for (let i = 0; i < this.data.length; ++i)
            this.data[i].encode(array);

        array.push("e".charCodeAt(0));
    }
}

class BencodeString extends BencodeObject
{
    public readonly value: string;

    constructor(value: string)
    {
        super();
        this.value = value;
    }

    encode(array: number[])
    {
        const bytesCount = stringByteCount(this.value);
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value));
    }
}

class BencodeInt extends BencodeObject
{
    public readonly value: number

    constructor(value: number)
    {
        super();
        this.value = value;
    }

    encode(array: number[])
    {
        array.push("i".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value.toString()));
        array.push("e".charCodeAt(0));
    }
}

const Bencode =
{
    EncodeToBytes: function(obj: TorrentObject)
    {
        const result: number[] = [];
        new BencodeDict(obj).encode(result);
        return result;
    }
};

let sha1: (data: Sha1Data) => Promise<Uint8Array>;

interface Sha1Data
{
    data: Uint8Array;
    blockSize: number;
    readChunkSize: number;
}

// workers
const maxWorkerCount = Math.min(navigator.hardwareConcurrency, 8); // use 8 workers at max, reading from disk will be the slowest anyways
(() =>
{
    const workers: Worker[] = [];
    for (let i = 0; i < maxWorkerCount; ++i)
        workers.push(new Worker("dist/sha1.js"));

    const busyWorkers = new Set();
    const waitingTasks: { data: Sha1Data, callback: (param: any) => any}[] = [];

    function EnqueueWorkerTask(data: Sha1Data, callback: (param: any) => any)
    {
        let selectedWorker: Worker | null = null;
        let selectedIndex: number;
        for (let i = 0; i < maxWorkerCount; ++i)
        {
            if (!busyWorkers.has(i))
            {
                selectedWorker = workers[i];
                selectedIndex = i;
                busyWorkers.add(i);
                break;
            }
        }

        if (!selectedWorker)
        {
            waitingTasks.push({ data, callback });
            return;
        }

        selectedWorker.postMessage(data, [data.data.buffer]);

        selectedWorker.onmessage = ev =>
        {
            busyWorkers.delete(selectedIndex);

            if (waitingTasks.length !== 0)
            {
                const task = waitingTasks.shift();
                if (task)
                    EnqueueWorkerTask(task.data, task.callback);
            }
            
            callback(ev.data);
        };
    }

    sha1 = function(data: Sha1Data)
    {
        return new Promise(resolve => EnqueueWorkerTask(data, resolve));
    };
})();
