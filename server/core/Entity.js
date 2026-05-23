export default class {
    id;
    ownerId;
    x;
    y;
    size;
    mass;
    skin;
    badge;
    clan;
    name;
    flags;
    partyCode;
    isFood;
    cellType;
    virusType;
    isVirus;
    isPellet;
    isFriend;
    isPlayer;
    isMine;
    isBot;
    isMinion;
    blockedFromAll;
    userRole;
    emoji;
    freeze;
    minionOwnerId;
    dead;
    eatenBy;
    constructor() {
        this.id = 0;
        this.ownerId = 0;
        this.x = 0;
        this.y = 0;
        this.badge = 0;
        this.name = "";
        this.size = 0;
        this.mass = 0;
        this.skin = 0;
        this.clan = "";
        this.flags = 0;
        this.partyCode = "";
        this.cellType = 0;
        this.isVirus = false;
        this.virusType = 0;
        this.isFood = false;
        this.isPellet = false;
        this.isFriend = false;
        this.isPlayer = false;
        this.isMine = false;
        this.isBot = false;
        this.isMinion = false;
        this.blockedFromAll = false;
        this.userRole = null;
        this.emoji = null;
        this.freeze = null;
        this.minionOwnerId = null;
        this.dead = false;
        this.eatenBy = 0;
    }
    destroy(bot) {
        delete bot.myCellIds[this.id];
        delete bot.nodes[this.id];
        const index = bot.ownCells.indexOf(this);
        if (index !== -1)
            bot.ownCells.splice(index, 1);
    }
}
