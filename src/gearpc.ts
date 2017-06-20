import { readString, writeString } from "./util";
import { Stream } from 'libvantage';

export interface GearPCObjective {
    type: number;
    unknown1: number;
    unknown2: number;
    unknown3: number;
    descriptionContext: string;
    descriptionId: string;
    name: string;
    data: Buffer; // location, unknown
    targets: string[];
}

export interface GearWeapon {
    objectName: number;
    slot: number;
    ammoUsedCount: number;
    spareAmmoCount: number;
    emptyCheck: number;
}

export class GearPC {
    private unknownZeroes: Buffer;
    private floatOne: number;
    public type: string;
    private locationData1: Buffer;
    public mesh: string;
    private unknownBytes1: Buffer; // Weapon holstered, team index?
    public squadName: number;
    private unknownBytes2: Buffer; // Something with weapon slots
    public weapons: GearWeapon[];
    public restOfData: Buffer;

    constructor(buffer: Buffer) {
        const io = new Stream(buffer);
        this.unknownZeroes = io.readBytes(16);
        this.floatOne = io.readFloat();
        this.type = readString(io);
        this.locationData1 = io.readBytes(32);
        this.mesh = readString(io);
        this.unknownBytes1 = io.readBytes(5);
        this.squadName = io.readUInt32();
        this.unknownBytes2 = io.readBytes(12);
        this.weapons = io.loopUInt32(() => this.readWeapon(io));
        this.restOfData = io.readToEnd();
    }

    private readWeapon(io: Stream): GearWeapon {
        return {
            objectName: io.readUInt32(),
            slot: io.readByte(),
            ammoUsedCount: io.readInt32(),
            spareAmmoCount: io.readUInt32(),
            emptyCheck: io.readInt32(),
        };
    }

    /*private readObjective(io: Stream): GearPCObjective {
        return {
            type: io.readUInt32(),
            unknown1: io.readInt32(),
            unknown2: io.readInt32(),
            unknown3: io.readByte(),
            descriptionContext: readString(io),
            descriptionId: readString(io),
            name: readString(io),
            data: io.readBytes(33),
            targets: io.loopUInt32(readString),
        };
    }*/

    public toBuffer(): Buffer {
        const io = Stream.reserve(1024);
        io.writeBytes(this.unknownZeroes);
        io.writeFloat(this.floatOne);
        writeString(io, this.type);
        io.writeBytes(this.locationData1);
        writeString(io, this.mesh);
        io.writeBytes(this.unknownBytes1);
        io.writeUInt32(this.squadName);
        io.writeBytes(this.unknownBytes2);
        io.writeUInt32(this.weapons.length);
        this.weapons.forEach(weapon => {
            io.writeUInt32(weapon.objectName);
            io.writeByte(weapon.slot);
            io.writeInt32(weapon.ammoUsedCount);
            io.writeUInt32(weapon.spareAmmoCount);
            io.writeInt32(weapon.emptyCheck);
        });
        io.writeBytes(this.restOfData);
        return io.getBuffer();
    }
}