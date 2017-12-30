import { SavepointBinaryBlob } from './savepoint';
import { SaveEditor, Stream, crc32 } from 'libvantage';
import { BindingSignaler } from 'aurelia-templating-resources';

import { GearSave } from './save';
import { GearPC } from './gearpc';
import { ObjectMap } from './savepoint';
import { GearController, CoordinateData } from './gearpc';

import weapons from './weapons';
import playerModels from './player-models';

const weaponsByModel = {};
weapons.forEach(weapon => weaponsByModel[weapon.model] = weapon);

const playerName = '/Game/Maps/SP/GearCampaign_P.GearCampaign_P.PersistentLevel.GearPC_SP_0';
const aiControllerName = '/Game/Maps/SP/GearCampaign_P.GearCampaign_P.PersistentLevel.GearAIController_COG_C';
const persistencePrefix = '/Game/Maps/SP/GearCampaign_P.GearCampaign_P.PersistentLevel.';
const bluePrintPrefix = '/Script/Engine.BlueprintGeneratedClass';
const aiControllerType = '/Game/Gameplay/AI/Controller/GearAIController_COG.GearAIController_COG_C';
const ammoMax = 100000000;
const safeDistance = 20;
const maxWeaponCount = 6;
// set a max for the number of squad members on the map
const maxAICount = 100;

interface Weapon {
    model: string;
    ammo: number;
}

export class Editor implements SaveEditor {
    private savedGame: GearSave;
    private savePoint: SavepointBinaryBlob;
    private player: GearPC;
    private squadType : number;
    private lastAIController : GearController;
    public aiCoordinates : CoordinateData; 
    public aiControllerMap: ObjectMap[];
    public playerModel: string;
    public signaler : BindingSignaler;

    public availablePlayerModels = playerModels;

    // player weapons
    public weapons: Weapon[];
    // current squad member
    public aiWeapons: Weapon[];

    public weaponModels = weaponsByModel;
    public availableWeapons = weapons.map(weapon => ({
        label: weapon.name,
        value: weapon.model,
    }));

    static inject() { return [BindingSignaler] };

    constructor(signaler) {      
        this.signaler = signaler;
    }

    public signalAIList() : void  {
        this.signaler.signal('ai-signal');
    }
    
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
        
        this.aiControllerMap = [];
        const gearControllers = this.savePoint.getObjectStructs(aiControllerName, true);
    
        this.squadType = 0;
        for (const entry in gearControllers) {
            // check for bad matches just in case
            if (!gearControllers[entry])
                throw new Error('Invalid AI Controller entry.');

            if(this.squadType === 0) {
                this.squadType = gearControllers[entry].objectType;
            } 
            this.aiControllerMap[entry] = new GearController(gearControllers[entry].data);  
        }    
    
        this.player = new GearPC(struct.data);
        this.playerModel = this.player.type;
        this.weapons = [];
        for (let x = 0; x < maxWeaponCount; x++) {
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
            if (weapon.model) {
                // set slots with weapons
                weapon.ammo = ammoMax;
            }
        });
    }

    public maxAIAmmo(): void {
        this.aiWeapons.forEach(weapon => {
            if(weapon.model) {
                // set slots with weapons
                weapon.ammo = ammoMax;
            }
        });
    }   
    
    public maxAllAIAmmo(): void {
        for(const aiCont in this.aiControllerMap) {
            const controller = this.aiControllerMap[aiCont];
            controller.weapons.forEach(weapon => {
                weapon.ammoUsedCount = 0;
                weapon.spareAmmoCount = ammoMax;
            });
        }
       
        // set current weapons (if any)
        this.maxAIAmmo();
    }

    public editAIProperties( controller : GearController) : void {
        this.modAIWeapons(controller);
        this.modPawnPosition(controller);
    }

    public modAIWeapons( controller : GearController) : void {
        // create new ai slot
        if(this.lastAIController)  {
            this.saveWeapons(this.lastAIController, this.aiWeapons);
        }

        this.aiWeapons = [];
        for (let x = 0; x < maxWeaponCount; x++) {
            this.aiWeapons.push({
                model: null,
                ammo: 0,
            });
        }
 
        this.lastAIController = controller;
        controller.weapons.forEach(weapon => {
            if (weapon.slot >= this.aiWeapons.length) {
                return;
            }
            const modelName = this.savePoint.getObjectName(weapon.objectName);
            const model = this.getWeaponFromModel(modelName);
            this.aiWeapons[weapon.slot] = {
                model: modelName,
                ammo: model ? weapon.spareAmmoCount + (model.clipSize - weapon.ammoUsedCount) : weapon.spareAmmoCount,
            };
        });
    }
    public modPawnPosition( controller : GearController) : void {
        this.aiCoordinates = controller.coordinates;
    }
    private getDistanceFromCoords( a : CoordinateData, b : CoordinateData) {
        return Math.sqrt( Math.pow((b.X-a.X), 2) + Math.pow((b.Y-a.Y), 2) );
    }
    private getFreePosition( baseCoordinates : CoordinateData) : CoordinateData    {
        const newpos = CoordinateData.copyFrom(baseCoordinates);
        let pos = CoordinateData.copyFrom(baseCoordinates);
        let dist = this.getDistanceFromCoords(newpos, pos);
    
        while((dist = this.getDistanceFromCoords(newpos, pos)) < safeDistance)
        {        
            for(const aiCont in this.aiControllerMap) {
                // add model name to object list if necessary
                pos = this.aiControllerMap[aiCont].coordinates;
                dist = this.getDistanceFromCoords(newpos, pos) ;
                if(dist < safeDistance)
                {
                    newpos.X += safeDistance;
                    newpos.Y += safeDistance;
                }
            }
        }
        newpos.Z += 100;// just in case to avoid low objects like stairs
        return newpos;
    }
    private getInstanceId(name: string): number {
        const instanceIndex = name.lastIndexOf('_');
        if (instanceIndex !== -1) {
            const possibleId = name.substr(instanceIndex + 1);
            if (possibleId.length !== 0 && (possibleId === '0' || possibleId.match(/^[1-9][0-9]*$/))) {
                return parseInt(possibleId) + 1;
            }
        }
        return 0;
    }
    public cloneAI( controller : GearController) : void {
        // create new ai slot
        let newControllerName = `${aiControllerName}_${Object.keys(this.aiControllerMap).length}`; 
        let replace = false;
        if(this.savePoint.hasObjectName(newControllerName))
        {
            for(let x = 0; x < maxAICount; x++) // set a reasonable max 100 actors
            {
                newControllerName = `${aiControllerName}_${x}`;
                if(this.savePoint.isStructReplaceable(newControllerName)){
                    replace = true;
                    break;
                }
                if(!this.savePoint.hasObjectName(newControllerName)) {
                    break;
                }
            }
        }

        // get the new object name id
        const objectName = this.savePoint.getSimpleObjectIndex(  
            newControllerName,
            aiControllerType
        );

        // create buffer
        const aiData = controller.toBuffer();   
        if(replace) {
            this.savePoint.setObjectStructAndType(newControllerName, this.squadType, aiData);
        }
        else {
            this.savePoint.addObjectStruct(objectName, this.squadType, aiData);
        }
          
        // add new AI controller to the list
        var newController = new GearController(aiData);
        newController.coordinates = this.getFreePosition(controller.coordinates);
        this.aiControllerMap[newControllerName] = newController;

        // update page
        this.signalAIList();  
    }

    public deleteAI(  controller : GearController) : void {
        let newControllerName = "";
        //const newControllerName = `${aiControllerName}_${controllerId}`;
        for(const aiCont in this.aiControllerMap) {
            // add model name to object list if necessary
            if(this.aiControllerMap[aiCont] === controller) {
                newControllerName = aiCont;
                break;
            }
        }
        if(newControllerName === ""){
            throw new Error('Attempting to delete an AI Controller entry.');
        }
        // remove from current list
        delete this.aiControllerMap[newControllerName];
        // delete object from save data
        this.savePoint.deleteObjectStruct(newControllerName);
        // update page
        this.signalAIList(); 
    }

    private saveWeapons(controller : any, weapons : Weapon[]) : void {
       controller.weapons = weapons.filter(w => !!w.model).map((weapon, x) => {
            const model = this.getWeaponFromModel(weapon.model);
            return {
                objectName: this.savePoint.getObjectIndex(weapon.model, bluePrintPrefix, true),
                slot: x,
                ammoUsedCount:  0,
                spareAmmoCount: model ? weapon.ammo - (model.clipSize) : weapon.ammo,
                extraWeapon: 0,
            }
        });
    }

    public save(): Buffer {
        
        this.savePoint.getObjectIndex(
            persistencePrefix + this.playerModel.split('.')[1],
            this.playerModel,
            false);

        this.player.type = this.playerModel;

        this.player.weapons = this.weapons.filter(w => !!w.model).map((weapon, x) => {
            const model = this.getWeaponFromModel(weapon.model);
            return {
                objectName: this.savePoint.getObjectIndex(weapon.model, bluePrintPrefix, true),
                slot: x,
                ammoUsedCount:  0,
                spareAmmoCount: weapon.ammo - (model.clipSize),
                extraWeapon: (x == 4) ? 1 : 0,
            }
        });
        this.savePoint.setObjectStruct(playerName, this.player.toBuffer());
        
        if(this.lastAIController)  {
            this.saveWeapons(this.lastAIController, this.aiWeapons);
        }
        for(const aiCont in this.aiControllerMap) {
            // add model name to object list if necessary
            this.savePoint.getObjectIndex(
                persistencePrefix + this.aiControllerMap[aiCont].type.split('.')[1],
               // aiControllerName,
                this.aiControllerMap[aiCont].type,
                false);
             // update controller data
            this.savePoint.setObjectStruct(aiCont, this.aiControllerMap[aiCont].toBuffer());
        }
        
        const savepointBuffer = this.savePoint.toBuffer();
        this.savedGame.root.SavepointBinaryBlob.buffer = savepointBuffer;
        this.savedGame.root.ChecksumKey.value = crc32(savepointBuffer);     
        const buffer = this.savedGame.toBuffer(); 

        return buffer;
    }
}

// A ValueConverter for iterating an Object's properties inside of a repeat.for in Aurelia
export class ObjectKeysValueConverter {
    toView(obj) {
       
        // Create a temporary array to populate with object keys
        let temp = [];
        
        // A basic for..in loop to get object properties
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...in
        for (let prop in obj) {
            if (obj.hasOwnProperty(prop)) {      
                temp.push(obj[prop]);
            }
        }        
        return temp;
    }
}