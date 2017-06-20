import { readString, writeString } from './util';
import { Stream } from 'libvantage';

class Header {
    public mapName: string;
    public mapId: Buffer;
    public unknown: Buffer; // uint32, uint64, uint32

    public static read(io: Stream): Header {
        const header = new Header();
        header.mapName = readString(io);
        header.mapId = io.readBytes(16);
        header.unknown = io.readBytes(16);
        return header;
    }

    public write(io: Stream): void {
        writeString(io, this.mapName);
        io.writeBytes(this.mapId);
        io.writeBytes(this.unknown);
    }
}

class ObjectName {
    public name: number;
    public instanceId: number;
    public parent: number;

    public static read(io: Stream): ObjectName {
        const name = new ObjectName();
        name.name = io.readUInt32();
        name.instanceId = io.readUInt32();
        name.parent = io.readInt32();
        return name;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.name);
        io.writeUInt32(this.instanceId);
        io.writeInt32(this.parent);
    }
}

class PackageFlags {
    public package: string;
    public flag1: number;
    public flag2: number;

    public static read(io: Stream): PackageFlags {
        const flags = new PackageFlags();
        flags.package = readString(io);
        flags.flag1 = io.readInt32();
        flags.flag2 = io.readInt32();
        return flags;
    }

    public write(io: Stream): void {
        writeString(io, this.package);
        io.writeInt32(this.flag1);
        io.writeInt32(this.flag2);
    }
}

class ObjectStruct {
    public objectName: number;
    public objectType: number;
    public data: Buffer;

    public static read(io: Stream): ObjectStruct {
        const struct = new ObjectStruct();
        struct.objectName = io.readUInt32();
        struct.objectType = io.readUInt32();
        struct.data = io.readBytes(io.readUInt32() + 45); // TODO: Sup with this?
        return struct;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.objectName);
        io.writeUInt32(this.objectType);
        io.writeUInt32(this.data.length - 45);
        io.writeBytes(this.data);
    }
}

class LevelFlag {
    public propertyName: number;
    public flag: boolean;

    public static read(io: Stream): LevelFlag {
        const flag = new LevelFlag();[]
        flag.propertyName = io.readUInt32();
        flag.flag = io.readBoolean();
        return flag;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.propertyName);
        io.writeBoolean(this.flag);
    }
}

class AIFactory {
    public objectName: number;
    public data: Buffer;

    public static read(io: Stream): AIFactory {
        const factory = new AIFactory();
        factory.objectName = io.readUInt32();
        factory.data = io.readBytes(io.readUInt32());
        return factory;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.objectName);
        io.writeUInt32(this.data.length);
        io.writeBytes(this.data);
    }
}

class NavComponent {
    public objectName: number;
    public unknown: number;
    public data: Buffer;

    public static read(io: Stream): NavComponent {
        const comp = new NavComponent();
        comp.objectName = io.readUInt32();
        comp.unknown = io.readInt32();
        comp.data = io.readBytes(io.readUInt32());
        return comp;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.objectName);
        io.writeInt32(this.unknown);
        io.writeUInt32(this.data.length);
        io.writeBytes(this.data);
    }
}

class ObjectProperties {
    public object: number;
    public properties1: Buffer;
    public properties2: Buffer;
    public type: string;

    public static read(io: Stream): ObjectProperties {
        const props = new ObjectProperties();    
        props.object = io.readUInt32();
        props.properties1 = io.readBytes(io.readUInt32());
        props.properties2 = io.readBytes(io.readUInt32());
        props.type = readString(io);
        return props;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.object);
        io.writeUInt32(this.properties1.length);
        io.writeBytes(this.properties1);
        io.writeUInt32(this.properties2.length);
        io.writeBytes(this.properties2);
        writeString(io, this.type);
    }
}

class UEObject {
    public name: number;
    public type: number;

    public static read(io: Stream): UEObject {
        const object = new UEObject();
        object.name = io.readUInt32();
        object.type = io.readUInt32();
        return object;
    }

    public write(io: Stream): void {
        io.writeUInt32(this.name);
        io.writeUInt32(this.type);
    }
}

class Save {
    public header: Header;
    public objectNames: ObjectName[];
    public strings: string[];
    public packageFlags: PackageFlags[];
    public structs: ObjectStruct[];
    public levelFlags: LevelFlag[];
    public aiFactories: AIFactory[];
    public navComponents: NavComponent[];
    public objectProperties: ObjectProperties[];
    public objectList: number[];
    public unknown: Buffer;
    public objects: UEObject[];
    public footer: Buffer;

    public static read(io: Stream): Save {
        const save = new Save();
        save.header = Header.read(io);
        save.objectNames = io.loopUInt32(ObjectName.read);
        save.strings = io.loopUInt32(readString);
        save.packageFlags = io.loopUInt32(PackageFlags.read);
        save.structs = io.loopUInt32(ObjectStruct.read);
        save.levelFlags = io.loopUInt32(LevelFlag.read);
        save.aiFactories = io.loopUInt32(AIFactory.read);
        save.navComponents = io.loopUInt32(NavComponent.read);
        save.objectProperties = io.loopUInt32(ObjectProperties.read);
        save.objectList = io.loopUInt32(() => io.readUInt32());
        save.unknown = io.readBytes(io.readUInt32());
        save.objects = io.loopUInt32(UEObject.read);
        save.footer = io.readToEnd();
        return save;
    }

    public write(io: Stream): void {
        this.header.write(io);
        this.writeData(io, this.objectNames);
        io.writeUInt32(this.strings.length);
        this.strings.forEach(s => writeString(io, s));
        this.writeData(io, this.packageFlags);
        this.writeData(io, this.structs);
        this.writeData(io, this.levelFlags);
        this.writeData(io, this.aiFactories);
        this.writeData(io, this.navComponents);
        this.writeData(io, this.objectProperties);
        io.writeUInt32(this.objectList.length);
        this.objectList.forEach(o => io.writeUInt32(o));
        io.writeUInt32(this.unknown.length);
        io.writeBytes(this.unknown);
        this.writeData(io, this.objects);
        io.writeBytes(this.footer);
    }

    private writeData(io: Stream, array: any[]): void {
        io.writeUInt32(array.length);
        array.forEach(el => el.write(io));
    }
}

export class SavepointBinaryBlob {
    public data: Save;
    public objectNameStrings: string[];

    constructor(data: Buffer) {
        this.data = Save.read(new Stream(data));
        this.objectNameStrings = this.parseObjectNames(this.data.objectNames);
    }

    public getOrAddStringIndex(string: string): number {
        const existing = this.data.strings.indexOf(string);
        if (existing !== -1) {
            return existing;
        }
        this.data.strings.push(string);
        return this.data.strings.length - 1;
    }

    public replaceObjectName(from: string, to: string): void {
        const pathParts = to.split('.');
        const [immediateName, instanceId] = this.getNameAndInstanceId(pathParts.pop());
        const index = this.objectNameStrings.indexOf(from);
        const name = this.data.objectNames[index];
        name.name = this.getOrAddStringIndex(immediateName);
        name.instanceId = instanceId;
        name.parent = this.storeObjectName(this.data.objectNames, pathParts);
        this.objectNameStrings[index] = to;
    }

    public getObjectName(index: number): string {
        return this.objectNameStrings[this.data.objects[index].name];
    }
    public hasObjectName(name: string): boolean {
        return this.objectNameStrings.includes(name);
    }

    public getObjectIndexOriginal(name: string, type: string): number {
        const nameIndex = this.storeObjectName(this.data.objectNames, name.split('.'));
        if (nameIndex === this.objectNameStrings.length) {
            this.objectNameStrings.push(name);
        } else {
            this.objectNameStrings[nameIndex] = name;
        }
        const typeIndex = this.storeObjectName(this.data.objectNames, type.split('.'));
        if (typeIndex === this.objectNameStrings.length) {
            this.objectNameStrings.push(type);
        } else {
            this.objectNameStrings[typeIndex] = type;
        }
        this.objectNameStrings[typeIndex] = type;
        const existing = this.data.objects.findIndex(o => o.name === nameIndex && o.type === typeIndex);
        if (existing !== -1) {
            return existing;
        }
        const object = new UEObject();
        object.name = nameIndex;
        object.type = typeIndex;        
        this.data.objects.push(object);
        return this.data.objects.length - 1;
    }
    public getObjectIndex(name: string, type: string, insert: number): number {
        const nameIndex = this.storeObjectName(this.data.objectNames, name.split('.'));
        const typeIndex = this.storeObjectName(this.data.objectNames, type.split('.'));
        const existing = this.data.objects.findIndex(o => o.name === nameIndex && o.type === typeIndex);
        if (existing !== -1) {
            return existing;
        }
        const object = new UEObject();
        object.name = nameIndex;
        object.type = typeIndex;
        if (insert == 1) {
            this.data.objectList.push(nameIndex);
        } else if(insert == 2) {
            this.data.objectList.push(typeIndex);
        }     
        this.data.objects.push(object);
        return this.data.objects.length - 1;
    }

    public getObjectStruct(name: string): ObjectStruct {
        return this.data.structs.find(s => s.objectName === this.objectNameStrings.indexOf(name));
    }

    private parseObjectNames(names: ObjectName[]): string[] {
        const strings = this.data.strings;
        return names.map((_, x) => {
            const parts: string[] = [];
            do {
                const current = names[x];
                parts.push(strings[current.name] + (current.instanceId ? ('_' + (current.instanceId - 1)) : ''));
                x = current.parent;
            } while (x !== -1)
            return parts.reverse().join('.');
        });
    }

    private serializeObjectNames(): ObjectName[] {
        const names: ObjectName[] = [];
        this.objectNameStrings.forEach(path => this.storeObjectName(names, path.split('.')));
        return names;
    }

    private storeObjectName(names: ObjectName[], pathParts: string[]): number {
        let currentParent = -1;
        pathParts.forEach(name => {
            const [realName, instanceId] = this.getNameAndInstanceId(name);
            currentParent = this.storeObjectPathPart(names, realName, instanceId, currentParent);
        });
        return currentParent;
    }

    private getNameAndInstanceId(name: string): [string, number] {
        const instanceIndex = name.lastIndexOf('_');
        if (instanceIndex !== -1) {
            const possibleId = name.substr(instanceIndex + 1);
            if (possibleId.length !== 0 && (possibleId === '0' || possibleId.match(/^[1-9][0-9]*$/))) {
                return [name.substr(0, instanceIndex), parseInt(possibleId) + 1];
            }
        }
        return [name, 0];
    }

    private storeObjectPathPart(names: ObjectName[], name: string, instanceId: number, parent: number): number {
        const strings = this.data.strings;
        const existing = names.findIndex(n => n.parent === parent && n.instanceId === instanceId && strings[n.name] === name);
        if (existing !== -1) {
            return existing;
        }
        const newName = new ObjectName();
        newName.name = this.getOrAddStringIndex(name);
        newName.instanceId = instanceId;
        newName.parent = parent;
        names.push(newName);
        return names.length - 1;
    }

    public toBuffer(): Buffer {
        this.objectNameStrings = this.parseObjectNames(this.data.objectNames); 
        this.data.objectNames = this.serializeObjectNames();
        const io = Stream.reserve(500 * 1024);
        this.data.write(io);
        return io.getBuffer();
    }
}

// Below is code for parsing the unused property data blocks.
/**
 * 
 * interface PropertyData
{
    elementType: any;
    intCount: any;
    dataInts: any;
    data: any;
}

interface ScriptStuff {
    name: string;
    type?: string;
    length?: any;
    data?: any;
    properties?: PropertyData;
}

 *     private parseScript(buffer: Buffer): ScriptStuff[] {
        return this.readProperties(new Stream(buffer));
    }

    private readProperties(io: Stream, len: number = 9999999): ScriptStuff[] {
        const stuff: ScriptStuff[] = [];
        while (len-- && !io.eof) {
            const propertyName = this.readString64(io);
            if (propertyName === 'None') {
                stuff.push({
                    name: propertyName,
                });
                          
                continue;
            }
            const propertyType = this.readString64(io);
            const length = io.readUInt64Unsafe();
            let data: any;

            var props = <PropertyData>{};
            switch (propertyType) {
                case 'ArrayProperty':
                    const elementType = this.readString64(io);
                    const intCount = io.readUInt32();
                    props.intCount = intCount;
                    props.dataInts = io.readBytes(intCount * 4);
                    data = this.readProperties(io, length);
                    break;
                case 'BoolProperty':
                    data = io.readBoolean();
                    break;
                case 'IntProperty':
                    data = io.readInt32();
                    break;
                case 'FloatProperty':
                    data = io.readFloat();
                    break;
                case 'ObjectProperty':
                    props.elementType = io.readUInt32();
                    data = this.objects[props.elementType];
                    break;
                default:
                    data = io.readBytes(length);
                    break;
            }
            stuff.push({
                name: propertyName,
                type: propertyType,
                length : length,
                data,
                properties: props
            });
        }
        return stuff;
    }

    private serializeScriptStuff(io : Stream, s : ScriptStuff) 
    {        
        io.writeUInt64(s.nameId);
              
        if (s.name === 'None') {
            return;
        }
        io.writeUInt64(s.typeId);        
        io.writeUInt64(s.length); 
        
        switch (s.type) {
     
            case 'ArrayProperty':
                io.writeUInt64(s.properties.elementType);
                io.writeUInt32(s.properties.intCount);
                io.writeBytes(s.properties.dataInts);
                s.data.forEach(r => this.serializeScriptStuff(io, r));
             
                break;
            case 'ObjectProperty':
                io.writeUInt32(s.properties.elementType);
                break;
            case 'BoolProperty':
                io.writeBoolean(s.data);
                break;
            case 'IntProperty':
                io.writeUInt32(s.data);
                break;
            case 'FloatProperty': 
                io.writeFloat(s.data);
                break;                 
            default:
                if(s.length > 0) {
                    io.writeBytes(Buffer.from(s.data));
                }
                break;
        }
    }
 */