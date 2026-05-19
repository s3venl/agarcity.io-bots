export default class {
    id;
    x;
    y;
    name;
    size;
    flags;
    isFood;
    cellType;
    virusType;
    extendedFlags;
    extraData;
    isVirus;
    isPellet;
    isFriend;
    isPlayer;
    isMe;
    constructor() {
        this.id = 0;
        this.x = 0;
        this.y = 0;
        this.name = null;
        this.size = 0;
        this.flags = 0;
        this.cellType = 0;
        this.virusType = 0;
        this.isFood = false;
        this.extendedFlags = 0;
        this.extraData = '';
        this.isVirus = false;
        this.isPellet = false;
        this.isFriend = false;
        this.isPlayer = false;
        this.isMe = false;
    }
}
