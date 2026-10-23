export function Track(..._: unknown[]) {}

export const KB = 1024;
export const MB = KB * 1024;
export const GB = MB * 1024;
export function GetSizeStr(size: number) {
    if (size < KB) {
        return size + " bytes";
    }

    if (size < MB) {
        return ((size / KB) | 0) + " KiB";
    }

    if (size < GB) {
        return ((size / MB) | 0) + " MiB";
    }

    return (size / GB).toFixed(2) + " GiB";
}

// For each file, increase their progress contribution by a constant amount, regardless of their size
// Reading many small files is slower than reading one large file, even if their total size is the same
// This bias is just an arbitrary value that makes the progress more smooth (by making smaller files take up more of the total progress)
export const fileSizeBias = 16 * MB;

export function getLines(str: string) {
    return str.split(/\s+/g).filter(line => line.length !== 0);
}

export function resizeTextArea(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = element.scrollHeight - 10 + "px";
}

export function formatTextAreaLines(element: HTMLTextAreaElement, resize = true) {
    const lines = getLines(element.value);

    if (lines.length === 0) {
        element.value = "";
    } else {
        element.value = lines.join("\n") + "\n";
    }

    if (resize) {
        resizeTextArea(element);
    }
}

type ResultData<TResult, TErr> =
    | {
          isError: false;
          result: TResult;
      }
    | {
          isError: true;
          error: TErr;
      };

export class Result<TResult, TErr> {
    private data: ResultData<TResult, TErr>;

    private constructor(data: ResultData<TResult, TErr>) {
        this.data = data;
    }

    public static ok<TResult, TErr>(result: TResult) {
        return new Result<TResult, TErr>({
            isError: false,
            result,
        });
    }

    public static error<TResult, TErr>(error: TErr) {
        return new Result<TResult, TErr>({
            isError: true,
            error,
        });
    }

    public getResult(): TResult | null {
        if (this.data.isError) {
            return null;
        }

        return this.data.result;
    }

    public getError(): TErr | null {
        if (!this.data.isError) {
            return null;
        }

        return this.data.error;
    }

    public isOk() {
        return this.getResult() !== null;
    }

    public isError() {
        return this.getError() !== null;
    }

    public getData() {
        return this.data;
    }
}
