import { createHiveConflictScenario, HIVE_CONFLICT_ID } from './HiveConflictScenario.js';
import { LEVELS_DATA } from '../data/levelsData.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig } from '../data/BattleCatalog.js';
import { getBattlefieldMapVariant } from '../data/BattlefieldMapVariants.js';
import { createBattlefieldLayout } from '../data/BattlefieldLayouts.js';
import { createBattlefieldOperation, bindBattleOperationToLayout } from './BattlefieldOperation.js';
import { bindOperationObjectivesToFronts } from './OperationObjectives.js';
import { applyBattleDifficulty } from './BattleStrategy.js';
import { validateOperationBossConfiguration } from '../data/BossEncounterValidation.js';

export function createOperationScene({operationId='pilot',level=LEVELS_DATA[0],players=1,layout=null,mapSeed=0,difficultyId='standard',legacyRoster=false,deploymentPlan='authored'}) {
  if(!Number.isInteger(mapSeed)||mapSeed<0||mapSeed>0xffffffff)throw new TypeError('Invalid operation map seed');
  const operation=operationId==='pilot'?null:BATTLE_OPERATIONS.find(row=>row.id===operationId);
  if(operationId!=='pilot'&&operationId!==HIVE_CONFLICT_ID&&!operation)throw new Error('Unknown battle operation');
  const variant=operation?getBattlefieldMapVariant(operation.mapId):null;
  if(variant)level=LEVELS_DATA.find(row=>row.id===variant.baseLevelId);
  layout??=createBattlefieldLayout({...level,mapId:variant?.id,strategicMode:true,mapSeed});
  if((layout.mapSeed??0)!==mapSeed)throw new TypeError('Operation layout seed differs from its preparation');
  const base=operationId===HIVE_CONFLICT_ID?createHiveConflictScenario(layout,{levelId:level.id,players}):operation?bindOperationObjectivesToFronts(bindBattleOperationToLayout(getBattleOperationConfig(operation.id,{playerCount:players,rosterDetail:legacyRoster?'legacy':'source',deploymentPlan}),layout)):createBattlefieldOperation(layout,{levelId:level.id,players});
  const config=applyBattleDifficulty(base,difficultyId);
  config.sceneSeed=mapSeed;
  const encounters=validateOperationBossConfiguration(config,level);
  return {config,layout,level,variant,encounters};
}
