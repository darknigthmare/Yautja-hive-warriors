import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { sourceUnitVisualKind } from '../js/data/SourceActorPresentation.js';

const create = () => new BattleSimulation(getBattleOperationConfig('AFF-27'));
const unitsIn = (sim,group) => group.units.map(id=>sim.units.get(id));

test('remote actors damage finite Hive Nodes with four attack slots, a 32-HP cap, and real ammunition',()=>{
  const sim=create();
  try {
    const before=sim.units.size;
    const victims=[...sim.units.values()].filter(u=>u.factionId==='human_force'&&u.state==='distant'&&u.hp>0).slice(0,3);
    assert.equal(victims.length,3);
    for (const victim of victims) {
      assert.equal(sim.recordDeath({entityId:victim.id,killerFaction:'hive',cause:'confirmed_hostile'}),true);
    }
    sim._hiveNodeStep(.25);
    const node=sim.getHiveNodeState().nodes[0];
    assert.ok(node);
    const builder=sim.getUnit(node.builderId);
    const nodeFront=sim.groups.get(builder.groupId).frontId;
    const humanGroup=[...sim.groups.values()].find(group=>
      group.factionId==='human_force'&&group.frontId===nodeFront&&
      group.units.some(id=>sourceUnitVisualKind(sim.units.get(id))==='sadar') &&
      group.units.some(id=>sourceUnitVisualKind(sim.units.get(id))==='sniper') &&
      unitsIn(sim,group).every(unit=>unit.state==='distant'));
    assert.ok(humanGroup,'the source has an existing specialist squad at the Drone front');
    const humans=unitsIn(sim,humanGroup),sniper=humans.find(unit=>sourceUnitVisualKind(unit)==='sniper'),
      sadar=humans.find(unit=>sourceUnitVisualKind(unit)==='sadar');
    const initialRounds=[sniper.sniperRounds,sadar.sadarMissiles];
    humanGroup.position=[...node.position];
    for(const unit of humans){unit.position=[...node.position];unit.nextAttack=0;}
    const visibleMap=groupList=>new Map([...sim.fronts.keys()].map(id=>[id,id===nodeFront?groupList:[]]));
    sim._groupsByFront=()=>visibleMap([humanGroup]);
    sim.time=10;
    sim._remoteCombat();
    const hp=sim.getHiveNodeState().nodes[0]?.hp;
    assert.ok(hp>0&&hp<node.hp,'node took limited strategic damage');
    assert.ok(node.hp-hp<=32,'cannot delete a 280-HP structure in a single 250-ms remote tick');
    assert.equal(sim.targetingCounters.attacksResolved,4);
    assert.equal(sniper.sniperRounds,initialRounds[0]-1);
    assert.equal(sadar.sadarMissiles,initialRounds[1]-1);
    for(const unit of humans.slice(4))assert.equal(unit.nextAttack,0,'no wasted cooldown beyond four attack slots');

    const hiveGroup=sim.groups.get(builder.groupId);
    assert.ok(unitsIn(sim,hiveGroup).some(unit=>unit.hp>0&&unit.state==='distant'));
    sim._groupsByFront=()=>visibleMap([humanGroup,hiveGroup]);
    for(const unit of humans)unit.nextAttack=0;
    const healthBefore=sim.getHiveNodeState().nodes[0].hp;
    sim.time=15;
    sim._remoteCombat();
    assert.equal(sim.getHiveNodeState().nodes[0].hp,healthBefore,
      'existing hostile combatants take target priority over a node');

    sim._groupsByFront=()=>visibleMap([humanGroup]);
    for(const unit of humans){unit.nextAttack=0;unit.position=[node.position[0]+45,node.position[1]];}
    sim.time=20;
    sim._remoteCombat();
    assert.equal(sim.getHiveNodeState().nodes[0].hp,healthBefore,
      'offscreen node cannot be damaged by a shooter beyond its actual attack range');
    assert.equal(sim.targetingCounters.attacksResolved,0);
    assert.equal(sim.units.size,before,'buildings are never soldiers');
    assert.equal(sim.assertConservation(),true);
  }finally{sim.dispose();}
});

test('remote node attrition survives save and resumes without a second death/infestation credit',()=>{
  const sim=create();
  try{
    const victims=[...sim.units.values()].filter(u=>u.factionId==='human_force'&&u.state==='distant'&&u.hp>0).slice(0,3);
    for(const victim of victims)sim.recordDeath({entityId:victim.id,killerFaction:'hive',cause:'confirmed_hostile'});
    sim._hiveNodeStep(.25);
    const node=sim.getHiveNodeState().nodes[0];
    const first=sim.damageHiveNode(node.id,67,'human_force');
    assert.equal(first.hp,213);
    const saved=sim.saveState();
    const restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{
      assert.equal(restored.getHiveNodeState().nodes[0].hp,213);
      assert.equal(restored.getHiveNodeState().banks[0].earned,3);
      assert.equal(restored.getCounts().hive.allocated,sim.getCounts().hive.allocated);
      assert.equal(restored.recordDeath({entityId:victims[0].id,killerFaction:'hive'}),false);
      assert.equal(restored.getHiveNodeState().banks[0].points,0);
      assert.equal(restored.assertConservation(),true);
    }finally{restored.dispose();}
  }finally{sim.dispose();}
});
