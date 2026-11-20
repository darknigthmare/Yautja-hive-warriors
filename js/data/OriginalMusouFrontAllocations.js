/* Five authored ORIGINAL Musou scenarios, drawn from the preserved
 * initialDeployment / FR-19..23 audit prose. These are original settings,
 * NEVER an AVP: Extinction or film-accurate deployment.
 *
 * This module does not spawn actors. It binds already budgeted platoons
 * to their front and places the commander in the EXISTING eight-member
 * command cell rather than a generic distant squad.
 */
const entry=(groupId,npc,{bossId=null}={})=>{
  if (!Number.isInteger(npc)||npc<=0||npc%({ 'GRP-12':2, 'GRP-13':4 }[groupId]??8)) throw new RangeError('invalid original squad size');
  const each={'GRP-12':2,'GRP-13':4}[groupId]??8;
  return Object.freeze({groupId,npc,squads:npc/each,...(bossId?{bossId}:{})});
};
const front=(id,enemy,ally=[])=>Object.freeze({
  front:id,enemy:Object.freeze(enemy),ally:Object.freeze(ally)
});
const troop=(id,count)=>entry(id,count);
const command= id=>entry('GRP-42',8,{bossId:id});
const assault=(n)=>[troop('GRP-11',n)];
const plasma=(n)=>[troop('GRP-13',n)];
const scout=(n)=>[troop('GRP-12',n)];
const frozen=(active,distant,reserve)=>Object.freeze({
  active:Object.freeze(active),distant:Object.freeze(distant),
  reserve:Object.freeze([reserve])
});
export const ORIGINAL_MUSOU_FRONT_PLANS=Object.freeze({
  'AFF-06':frozen([
    front('A',[troop('GRP-37',32)],plasma(4)),
    front('B',[troop('GRP-37',16)]),
    front('C',[troop('GRP-37',8),command('BOS-29')])
  ],[
    front('A',[troop('GRP-37',32)]),
    front('B',[troop('GRP-37',48)],scout(2)),
    front('C',[troop('GRP-37',48)],scout(2))
  ],front('Réserve',[troop('GRP-37',64)])),
  'AFF-07':frozen([
    front('A',[troop('GRP-38',24),command('BOS-30')],plasma(4)),
    front('B',[troop('GRP-38',16)]),
    front('C',[troop('GRP-38',16)])
  ],[
    front('A',[troop('GRP-38',32)]),
    front('B',[troop('GRP-38',48)],scout(2)),
    front('C',[troop('GRP-38',48)],scout(2))
  ],front('Réserve',[troop('GRP-38',64)])),
  'AFF-08':frozen([
    front('A',[troop('GRP-39',40),command('BOS-31')],assault(8)),
    front('B',[troop('GRP-39',32)],plasma(4)),
    front('C',[troop('GRP-39',24)]),
    front('D',[troop('GRP-39',24)])
  ],[
    front('A',[troop('GRP-39',96)]),
    front('B',[troop('GRP-39',96)]),
    front('C',[troop('GRP-39',96)],assault(8)),
    front('D',[troop('GRP-39',96)],plasma(4))
  ],front('Réserve',[troop('GRP-39',256)],assault(8))),
  'AFF-09':frozen([
    front('A',[troop('GRP-40',40),command('BOS-30')],assault(8)),
    front('B',[troop('GRP-40',32)],plasma(4)),
    front('C',[troop('GRP-40',24)]),
    front('D',[troop('GRP-40',24)])
  ],[
    front('A',[troop('GRP-40',96)]),
    front('B',[troop('GRP-40',96)]),
    front('C',[troop('GRP-40',96)],assault(8)),
    front('D',[troop('GRP-40',96)],plasma(4))
  ],front('Réserve',[troop('GRP-40',256)],assault(8))),
  'AFF-10':frozen([
    front('A',[troop('GRP-41',48)],assault(8)),
    front('B',[troop('GRP-41',24),command('BOS-31')],plasma(4)),
    front('C',[troop('GRP-41',24)]),
    front('D',[troop('GRP-41',24)])
  ],[
    front('A',[troop('GRP-41',96)]),
    front('B',[troop('GRP-41',96)]),
    front('C',[troop('GRP-41',96)],assault(8)),
    front('D',[troop('GRP-41',96)],plasma(4))
  ],front('Réserve',[troop('GRP-41',256)],assault(8)))
});

export const ORIGINAL_MUSOU_COMMANDER_FRONTS=Object.freeze({
  'AFF-06':Object.freeze({front:'C',boss:'BOS-29',template:'GRP-42'}),
  'AFF-07':Object.freeze({front:'A',boss:'BOS-30',template:'GRP-42'}),
  'AFF-08':Object.freeze({front:'A',boss:'BOS-31',template:'GRP-42'}),
  'AFF-09':Object.freeze({front:'A',boss:'BOS-30',template:'GRP-42'}),
  'AFF-10':Object.freeze({front:'B',boss:'BOS-31',template:'GRP-42'})
});
export function getOriginalMusouFrontPlan(operationId) {
  return typeof operationId==='string' && Object.hasOwn(ORIGINAL_MUSOU_FRONT_PLANS,operationId)
    ? ORIGINAL_MUSOU_FRONT_PLANS[operationId]:null;
}
