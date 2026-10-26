/** A checkpoint keeps its reward identity even when its rendered mission is
 * rebuilt. An individual casualty cannot credit the wallet a second time. */
export function combatRewardIdentity(game,event){const sessionId=game.rewardSessionId??game.missionRun;return{id:`${sessionId}:death:${event.entityId}`,sessionId};}
