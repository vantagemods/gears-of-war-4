import { SavepointBinaryBlob } from './savepoint';
import { SaveEditor, Stream, crc32 } from 'libvantage';
import { GearSave } from './save';
import { GearPC } from './gearpc';
import weapons from './weapons';
import playerModels from './player-models';

const weaponsByModel = {};
weapons.forEach(weapon => weaponsByModel[weapon.model] = weapon);

const playerName = '/Game/Maps/SP/GearCampaign_P.GearCampaign_P.PersistentLevel.GearPC_SP_0';

interface Weapon {
    model: string;
    ammo: number;
}

export class Editor implements SaveEditor {
    private savedGame: GearSave;
    private savePoint: SavepointBinaryBlob;
    private player: GearPC;

    public playerModel: string;
    public availablePlayerModels = playerModels;

    public weapons: Weapon[];
    public weaponModels = weaponsByModel;
    public availableWeapons = weapons.map(weapon => ({
        label: weapon.name,
        value: weapon.model,
    }));

    public load(buffer: Buffer): void {
        this.savedGame = new GearSave(new Stream(buffer));

        const savepointBuffer = this.savedGame.root.SavepointBinaryBlob.buffer;
        if (!this.savedGame.root.ChecksumKey) {
            throw new Error('Checksum not found.');
        }
        if (crc32(savepointBuffer) !== this.savedGame.root.ChecksumKey.value) {
            throw new Error('Invalid checksum.');
        }

        this.savePoint = new SavepointBinaryBlob(savepointBuffer);

        const struct = this.savePoint.getObjectStruct(playerName);
        if (!struct) {
            throw new Error('Player not found in save.');
        }

        this.player = new GearPC(struct.data);
        this.playerModel = this.player.type;
        this.weapons = [];
        for (let x = 0; x < 6; x++) {
            this.weapons.push({
                model: null,
                ammo: undefined,
            });
        }
        this.player.weapons.forEach(weapon => {
            if (weapon.slot >= this.weapons.length) {
                return;
            }
            const modelName = this.savePoint.getObjectName(weapon.objectName);
            const model = this.getWeaponFromModel(modelName);
            this.weapons[weapon.slot] = {
                model: modelName,
                ammo: model ? weapon.spareAmmoCount + (model.clipSize - weapon.ammoUsedCount) : weapon.spareAmmoCount,
            };
        });
    }

    private getWeaponFromModel(model: string): any {
        return weapons.find(w => w.model === model);
    }

    public maxAmmo(): void {
        this.weapons.forEach(weapon => {
            const model = this.getWeaponFromModel(weapon.model);
            if (model) {
                // Keep a full clip.
                weapon.ammo = 9999999 - (9999999 % model.clipSize);
            }
        });
    }

    public save(): Buffer {
        const idx = this.savePoint.getObjectIndex(
            '/Game/Maps/SP/GearCampaign_P.GearCampaign_P.PersistentLevel.' + this.playerModel.split('.')[1],
            this.playerModel, 
            2);
        this.player.type = this.playerModel;
        const originalWeapons = this.player.weapons;
        this.player.weapons = this.weapons.filter(w => !!w.model).map((weapon, x) => {
            const model = this.getWeaponFromModel(weapon.model);
            return {
                objectName: this.savePoint.getObjectIndex(weapon.model, '/Script/Engine.BlueprintGeneratedClass', 1),
                slot: x,
                ammoUsedCount: model ? model.clipSize - (weapon.ammo % model.clipSize) : 0,
                spareAmmoCount: model ? Math.floor(weapon.ammo / model.clipSize) * model.clipSize : weapon.ammo,
                emptyCheck: 0,
            }
        });
        this.savePoint.getObjectStruct(playerName).data = this.player.toBuffer();
        const savepointBuffer = this.savePoint.toBuffer();
        this.savedGame.root.SavepointBinaryBlob.buffer = savepointBuffer;
        this.savedGame.root.ChecksumKey.value = crc32(savepointBuffer);     
        const buffer = this.savedGame.toBuffer(); 
        return buffer;
    }
}