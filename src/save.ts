import { readString, writeString } from './util';
import { Stream } from 'libvantage';

const SAVG = 0x53415647;

export class GearSave {
    private header: Buffer;
    public releaseName: string;
    public root: UEProperty|any;

    constructor(io: Stream) {
        if (io.readUInt32() !== SAVG) {
            throw new Error('Invalid magic.');
        }
        this.header = io.readBytes(18);

        // Extract the root element because it's not a 
        // nice name for a property. ++depot+UE4-Releases+4.9
        const root = {};
        readProperties(io, root);
        this.releaseName = Object.getOwnPropertyNames(root)[0];
        this.root = root[this.releaseName];
    }

    public toBuffer(): Buffer {
        const io = Stream.reserve(500 * 1024);
        io.writeUInt32(SAVG);
        io.writeBytes(this.header);
        writeProperties(io, {[this.releaseName]: this.root});
        return io.getBuffer();
    }
}

export interface UEProperty {
    write(io: Stream): void;
    getType(): string;
}

export class ArrayProperty implements UEProperty {
    private elementType: string;
    public buffer: Buffer;

    constructor(io: Stream) {
        io.position += 8; // Skip length
        this.elementType = readString(io);
        if (this.elementType !== 'ByteProperty') {
            throw new Error('Unsupported for now.')
        }
        this.buffer = io.readBytes(io.readUInt32());
    }

    public write(io: Stream): void {
        io.writeUInt32(this.buffer.length + 4);
        io.writeUInt32(0);
        writeString(io, this.elementType);
        io.writeUInt32(this.buffer.length);
        io.writeBytes(this.buffer);
    }

    public getType(): string {
        return 'ArrayProperty';
    }
}

export class Int32Property implements UEProperty {
    public value: number;

    constructor(io: Stream) {
        io.position += 8;
        this.value = io.readInt32();
    }

    public write(io: Stream): void {
        io.writeUInt32(4);
        io.writeUInt32(0);
        io.writeInt32(this.value);
    }

    public getType(): string {
        return 'Int32Property';
    }
}

export class IntProperty extends Int32Property {
    constructor(io: Stream) {
        super(io);
    }

    public getType(): string {
        return 'IntProperty';
    }
}

export class UInt32Property implements UEProperty {
    public value: number;

    constructor(io: Stream) {
        io.position += 8;
        this.value = io.readUInt32();
    }

    public write(io: Stream): void {
        io.writeUInt32(4);
        io.writeUInt32(0);
        io.writeUInt32(this.value);
    }

    public getType(): string {
        return 'UInt32Property';
    }
}

export class GearSavepointSaveGame implements UEProperty {
    public SavepointBinaryBlob: ArrayProperty;
    public ChecksumKey: Int32Property;
    public VersionNum: IntProperty;
    public BuildCL: IntProperty;
    public None: null;

    constructor(io: Stream) {
        readProperties(io, this);
    }

    public write(io: Stream): void {
        writeProperties(io, this);
    }

     public getType(): string {
        return 'GearSavepointSaveGame';
    }
}

export const structs = {
    GearSavepointSaveGame: GearSavepointSaveGame,
    ArrayProperty: ArrayProperty,
    IntProperty: IntProperty,
    Int32Property: Int32Property,
    UInt32Property: UInt32Property,
};

function readProperties(io: Stream, obj: object): void {
    while (!io.eof) {
        const name = readString(io);
        const type = readString(io);
        if (type.length === 0) {
            obj[name] = null;
            break;
        }
        obj[name] = new structs[type](io);
    }
}

function writeProperties(io: Stream, obj: object): void {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        writeString(io, prop);
        if (obj[prop] === null) {
            io.writeUInt32(0);
        } else {
            writeString(io, obj[prop].getType());
            obj[prop].write(io);
        }
    }
}
