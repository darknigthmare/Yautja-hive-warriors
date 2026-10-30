/** Simulation culling still calls the actor bridge. Keep that authority alive
 * until every materialized group has returned its final physical snapshot. */
export function disposeBattleOperation(game) {
  game.operationTransport?.dispose();game.operationTransport=null;game.companionLoadouts=null;
  const simulation=game.battleSimulation, bridge=game.battleBridge;
  try { simulation?.dispose(); }
  finally {
    game.allyRescue?.dispose();game.allyRescue=null;
    game.bossPhasePressure?.dispose();game.bossPhasePressure=null;
    bridge?.dispose();
    game.hiveNodeWorld?.dispose();game.hiveNodeWorld=null;
    game.operationObjectives?.dispose();game.operationWorld?.dispose();
    game.battleSimulation=null;game.battleBridge=null;game.operationObjectives=null;game.operationWorld=null;
    game.operationPanel?.update(null);game.ui?.updateOperationHUD?.(null);
    globalThis.document?.getElementById('ally-rescue-prompt')?.classList.add('hidden');
  }
}
