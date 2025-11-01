export interface FolderElement {
    files: Map<string, File>;
    folders: Map<string, FolderElement>;
}

export const enum InputType {
    File,
    Folder,
}

export interface FileWithPath {
    path: string[]; // Including the file name
    file: File;
}

export interface SelectedFileOrFolderInfo {
    name: string;
    size: number;
    input:
        | {
              type: InputType.File;
              file: File;
          }
        | {
              type: InputType.Folder;
              rootFolder: FolderElement;
          };

    fileList: FileWithPath[];
}

export function createFolderStructure(files: FileList) {
    const rootFolder: FolderElement = {
        files: new Map(),
        folders: new Map(),
    };

    for (const file of files) {
        let targetFolder = rootFolder;

        if (file.webkitRelativePath !== "") {
            const segments = file.webkitRelativePath.split("/");

            // First segment is the root folder, last segment is the file name
            for (let i = 1; i < segments.length - 1; ++i) {
                const segment = segments[i];

                let childFolder = targetFolder.folders.get(segment);
                if (childFolder === undefined) {
                    childFolder = {
                        files: new Map(),
                        folders: new Map(),
                    };

                    targetFolder.folders.set(segment, childFolder);
                }

                targetFolder = childFolder;
            }
        }

        targetFolder.files.set(file.name, file);
    }

    return rootFolder;
}

export function loadFileOrFolder(files: FileList | null): SelectedFileOrFolderInfo | null {
    if (files === null) {
        return null;
    }

    const rootFolder = createFolderStructure(files);

    function getFolderSize(folder: FolderElement) {
        let size = 0;

        for (const file of folder.files.values()) {
            size += file.size;
        }

        for (const childFolder of folder.folders.values()) {
            size += getFolderSize(childFolder);
        }

        return size;
    }

    const totalSize = getFolderSize(rootFolder);

    let name = "unknown";
    let input: SelectedFileOrFolderInfo["input"] | null = null;
    const fileList: FileWithPath[] = [];

    if (rootFolder.folders.size === 0 && rootFolder.files.size === 1) {
        // Single file

        for (const [fileName, file] of rootFolder.files) {
            name = fileName;
            input = {
                type: InputType.File,
                file,
            };

            break;
        }

        if (input !== null) {
            fileList.push({
                path: [name], // This path is only used for displaying progress
                file: input.file,
            });
        }
    } else {
        // Folder

        let folderName: string | null = null;

        function visitFolder(folder: FolderElement, pathSegments: string[]) {
            for (const [childFolderName, childFolder] of folder.folders) {
                pathSegments.push(childFolderName);
                visitFolder(childFolder, pathSegments);
                pathSegments.pop();
            }

            for (const [fileName, file] of folder.files) {
                fileList.push({
                    path: [...pathSegments, fileName],
                    file,
                });

                if (folderName === null) {
                    const baseFolder = file.webkitRelativePath.split("/")[0];

                    if (baseFolder.length !== 0) {
                        folderName = baseFolder;
                    }
                }
            }
        }

        visitFolder(rootFolder, []);

        if (folderName !== null) {
            name = folderName;
        }

        input = {
            type: InputType.Folder,
            rootFolder,
        };
    }

    if (input === null) {
        // Shouldn't happen
        return null;
    }

    return {
        name,
        size: totalSize,
        input,
        fileList,
    };
}
