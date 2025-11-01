function* toUTF8Bytes(str: string) {
    for (let i = 0; i < str.length; ++i) {
        let charcode = str.charCodeAt(i);

        if (charcode < 0x80) {
            yield charcode;
        } else if (charcode < 0x800) {
            yield 0xc0 | (charcode >> 6);
            yield 0x80 | (charcode & 0x3f);
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
            yield 0xe0 | (charcode >> 12);
            yield 0x80 | ((charcode >> 6) & 0x3f);
            yield 0x80 | (charcode & 0x3f);
        } else {
            ++i;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));

            yield 0xf0 | (charcode >> 18);
            yield 0x80 | ((charcode >> 12) & 0x3f);
            yield 0x80 | ((charcode >> 6) & 0x3f);
            yield 0x80 | (charcode & 0x3f);
        }
    }
}

function stringByteCountUTF8(str: string) {
    let count = 0;
    for (let i = 0; i < str.length; ++i) {
        const charcode = str.charCodeAt(i);
        if (charcode < 0x80) {
            ++count;
        } else if (charcode < 0x800) {
            count += 2;
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
            count += 3;
        } else {
            ++i;
            count += 4;
        }
    }

    return count;
}

interface IBencodeDict {
    [key: string]: IBencodeObject | undefined;
}

type IBencodeList = IBencodeObject[];

type IBencodeString = string;
type IBencodeBinaryString = Uint8Array;
type IBencodeInt = number;

type IBencodeObject = IBencodeDict | IBencodeList | IBencodeString | IBencodeBinaryString | IBencodeInt;

export class BencodeBuffer {
    private bytesList: Uint8Array[] = [];

    public getBytes() {
        let totalSize = 0;
        for (const bytes of this.bytesList) {
            totalSize += bytes.length;
        }

        const result = new Uint8Array(totalSize);

        let offset = 0;
        for (const bytes of this.bytesList) {
            result.set(bytes, offset);
            offset += bytes.length;
        }

        return result;
    }

    public writeTextUTF8(text: string) {
        this.bytesList.push(new Uint8Array(toUTF8Bytes(text)));
    }

    public writeBytes(bytes: Uint8Array) {
        this.bytesList.push(bytes);
    }
}

abstract class BencodeObject {
    abstract encode(buffer: BencodeBuffer): BencodeBuffer;

    public getBencodeObject(obj: IBencodeObject): BencodeObject {
        switch (typeof obj) {
            case "number":
                return new BencodeInt(obj);

            case "string":
                return new BencodeString(obj);

            case "object": {
                if (obj instanceof Uint8Array) {
                    return new BencodeBinaryString(obj);
                }

                if (Array.isArray(obj)) {
                    return new BencodeList(obj);
                }

                return new BencodeDict(obj);
            }
        }
    }
}

export class BencodeDict extends BencodeObject {
    private data: Record<string, BencodeObject>;

    constructor(obj: IBencodeDict) {
        super();
        this.data = {};

        for (const key in obj) {
            const value = obj[key];
            if (value === undefined) {
                continue;
            }

            const bencodeObj = this.getBencodeObject(value);

            if (bencodeObj) {
                this.data[key] = bencodeObj;
            }
        }
    }

    public encode(buffer: BencodeBuffer) {
        buffer.writeTextUTF8("d");

        const sortedKeys = Object.keys(this.data).sort();

        for (const currentKey of sortedKeys) {
            new BencodeString(currentKey).encode(buffer);
            this.data[currentKey].encode(buffer);
        }

        buffer.writeTextUTF8("e");

        return buffer;
    }
}

export class BencodeList extends BencodeObject {
    private data: BencodeObject[];

    constructor(list: IBencodeList) {
        super();
        this.data = list.map(data => this.getBencodeObject(data));
    }

    public encode(buffer: BencodeBuffer) {
        buffer.writeTextUTF8("l");

        for (const data of this.data) {
            data.encode(buffer);
        }

        buffer.writeTextUTF8("e");

        return buffer;
    }
}

export class BencodeString extends BencodeObject {
    public readonly value: string;

    constructor(value: IBencodeString) {
        super();
        this.value = value;
    }

    public encode(buffer: BencodeBuffer) {
        buffer.writeTextUTF8(stringByteCountUTF8(this.value).toString());
        buffer.writeTextUTF8(":");
        buffer.writeTextUTF8(this.value);

        return buffer;
    }
}

export class BencodeBinaryString extends BencodeObject {
    public readonly value: Uint8Array;

    constructor(value: IBencodeBinaryString) {
        super();
        this.value = value;
    }

    public encode(buffer: BencodeBuffer) {
        buffer.writeTextUTF8(this.value.length.toString());
        buffer.writeTextUTF8(":");
        buffer.writeBytes(this.value);

        return buffer;
    }
}

export class BencodeInt extends BencodeObject {
    public readonly value: number;

    constructor(value: IBencodeInt) {
        super();
        this.value = value;
    }

    public encode(buffer: BencodeBuffer) {
        buffer.writeTextUTF8("i");
        buffer.writeTextUTF8(this.value.toString());
        buffer.writeTextUTF8("e");

        return buffer;
    }
}
