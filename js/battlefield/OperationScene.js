import { createHiveConflictScenario, HIVE_CONFLICT_ID } from './HiveConflictScenario.js';
import { LEVELS_DATA } from '../data/levelsData.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../data/BattleCatalog.js';
import { getBattlefieldMapVariant } from '../data/BattlefieldMapVariants.js';
import { createBattlefieldLayout } from '../data/BattlefieldLayouts.js';
import { createBattlefieldOperation, bindBattleOperationToLayout } from './BattlefieldOperation.js';
import { bindOperationObjectivesToFronts } from './OperationObjectives.js';

export function createOperationScene({operationId='pilot',level=LEVELS_DATA[0],players=1,layout=null}) {
  const operation=operationId==='pilot'?null:BATTLE_OPERATIONS.find(row=>row.id===operationId);
  if(operationId!=='pilot'&&operationId!==HIVE_CONFLICT_ID&&!operation)throw new Error('Unknown battle operation');
  const variant=operation?getBattlefieldMapVariant(operation.mapId):null;
  if(variant)level=LEVELS_DATA.find(row=>row.id===variant.baseLevelId);
  layout??=createBattlefieldLayout({...level,mapId:variant?.id,strategicMode:true});
  const config=operationId===HIVE_CONFLICT_ID?createHiveConflictScenario(layout,{levelId:level.id,players}):operation?bindOperationObjectivesToFronts(bindBattleOperationToLayout(getBattleOperationConfig(operation.id,{playerCount:players}),layout)):createBattlefieldOperation(layout,{levelId:level.id,players});
  return {config,layout,level,variant};
}
