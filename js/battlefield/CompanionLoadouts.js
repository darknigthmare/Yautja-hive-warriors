/* Finite equipment for already allocated original support actors. No actor or
 * ammunition is created by an order, changing a kit or loading a checkpoint. */
import { applyFormationImpact } from './FormationTactics.js';
const copy=value=>JSON.parse(JSON.stringify(value));
export const COMPANION_KITS=Object.freeze({
  medic_field:Object.freeze({id:'medic_field',role:'medic',label:'Medicomp de terrain',abilities:['heal']}),
  scout_recon:Object.freeze({id:'scout_recon',role:'scout',label:'Capteurs de reconnaissance',abilities:['recon']}),
  engineer_tools:Object.freeze({id:'engineer_tools',role:'engineer',label:'Outils et charges de sabotage',abilities:['repair','sabotage']}),
  support_ammo:Object.freeze({id:'support_ammo',role:'support',label:'Munitions de suppression',abilities:['suppress']})
});
const ABILITIES=Object.freeze({heal:{charges:3,range:5,cooldown:12},recon:{charges:3,range:30,cooldown:15},repair:{charges:3,range:6,cooldown:12},sabotage:{charges:2,range:6,cooldown:15},suppress:{charges:4,range:24,cooldown:10}});
const roles=new Set(Object.values(COMPANION_KITS).map(kit=>kit.role));
const refused=reason=>({accepted:false,reason});
export class CompanionLoadouts {
  constructor({simulation,actors,players=()=>[],environment=null}={}) {
    if(!simulation?.getUnit || !(actors instanceof Map) && typeof actors!=='function')throw new TypeError('Companions require an operation and its existing detailed actors');
    this.simulation=simulation;this.actors=actors;this.players=typeof players==='function' ? players : ()=>players;this.environment=environment;this.roster=new Map();this.events=[];
  }
  get time(){return this.simulation.time;}
  _actor(id){const item=(typeof this.actors==='function' ? this.actors() : this.actors).get(id);return item?.actor ?? item;}
  register(unitId,{role,allowedRoles=[role]}={}) {
    if(this.roster.has(unitId))return {accepted:true,companion:copy(this.roster.get(unitId)),existing:true};
    const unit=this.simulation.getUnit(unitId),profile=unit&&this.simulation.profiles.get(unit.profileId);
    const allowed=profile?.companionRoles ?? allowedRoles;
    if(!unit || unit.hp<=0 || this.simulation.relationship(unit.factionId,this.simulation.config.playerFaction)!=='allied' || !roles.has(role) || !Array.isArray(allowed) || !allowed.includes(role) || allowed.some(item=>!roles.has(item)) || unit.uniqueId && !profile?.companionRoles) return refused('eligible_allied_support_actor_required');
    const stock={};for(const kit of Object.values(COMPANION_KITS))if(allowed.includes(kit.role))for(const ability of kit.abilities)stock[ability]=ABILITIES[ability].charges;
    const kit=Object.values(COMPANION_KITS).find(item=>item.role===role);
    const entry={unitId,role,allowedRoles:[...new Set(allowed)],kitId:kit.id,charges:stock,cooldowns:{},uses:0};
    this.roster.set(unitId,entry);this._applyKit(entry);return {accepted:true,companion:copy(entry)};
  }
  equip(unitId,kitId) {
    const entry=this.roster.get(unitId),kit=COMPANION_KITS[kitId];
    if(!entry || !kit || !entry.allowedRoles.includes(kit.role))return refused('kit_outside_companion_profile');
    entry.kitId=kitId;entry.role=kit.role;if(entry.pending&&!kit.abilities.includes(entry.pending.order.type)){delete entry.pending;const actor=this._actor(unitId);if(actor)actor.companionOrderTarget=null;}this._applyKit(entry);return {accepted:true,companion:copy(entry)};
  }
  _applyKit(entry){const actor=this._actor(entry.unitId);if(actor){actor.companionRole=entry.role;actor.companionKitId=entry.kitId;actor.companionAllowsPlasma=entry.role==='support';}}
  _players(){return this.players().filter(Boolean);}
  _position(target){return target?.position?.isVector3 ? target.position : target?.mesh?.position;}
  _inRange(actor,target,range){const point=this._position(target),position=this._position(actor);return point && position && Math.hypot(position.x-point.x,position.z-point.z)<=range;}
  _clear(actor,target){if(!this.environment?.hasLineOfSight)return true;const from=this._position(actor).clone(),to=this._position(target).clone();from.y+=1.3;to.y+=1.3;return this.environment.hasLineOfSight(from,to);}
  _pointTarget(point){const position=this._position([...this._players(),...this.roster.keys()].map(item=>typeof item==='string' ? this._actor(item) : item).find(Boolean));if(!position)return null;const target=position.clone();target.set(point[0],0,point[1]);return {position:target};}
  queueOrder(unitId,order={}) {
    const entry=this.roster.get(unitId),unit=this.simulation.getUnit(unitId);
    if(!entry || !unit || unit.hp<=0 || this.simulation.disposed || this.simulation.result || !COMPANION_KITS[entry.kitId].abilities.includes(order.type) || this.simulation.relationship(unit.factionId,this.simulation.config.playerFaction)!=='allied')return refused('eligible_equipped_companion_required');
    if((entry.charges[order.type]??0)<=0)return refused('charges_exhausted');
    const request=Object.fromEntries(['type','targetUnitId','targetPlayerId','targetGroupId','frontId'].filter(key=>typeof order[key]==='string'&&order[key].length<=128).map(key=>[key,order[key]]));
    entry.pending={order:request,enqueuedAt:this.time,expiresAt:this.time+60};return {accepted:true,queued:true,unitId};
  }
  _orderTarget(order){
    if(order.type==='heal')return order.targetUnitId ? this._actor(order.targetUnitId) : this._players().find(player=>order.targetPlayerId==='player2' ? player.isPlayer2===true : player.isPlayer2!==true);
    const point=order.type==='suppress' ? this.simulation.groups.get(order.targetGroupId)?.position : this.simulation.fronts.get(order.frontId)?.position;
    return point ? this._pointTarget(point) : null;
  }
  command(unitId,order={}) {
    const entry=this.roster.get(unitId),actor=this._actor(unitId),unit=this.simulation.getUnit(unitId),ability=ABILITIES[order.type];
    if(this.simulation.disposed || this.simulation.result || this.simulation.paused)return refused('operation_unavailable');
    if(!entry || !actor || !(actor.hp>0) || !unit || unit.state!=='active' || !ability || !COMPANION_KITS[entry.kitId].abilities.includes(order.type))return refused('equipped_active_companion_required');
    if((entry.charges[order.type]??0)<=0)return refused('charges_exhausted');
    if((entry.cooldowns[order.type]??0)>this.time)return refused('ability_cooling_down');
    if(this.simulation.relationship(unit.factionId,this.simulation.config.playerFaction)!=='allied')return refused('companion_no_longer_allied');
    let effect;
    if(order.type==='heal') {
      const target=order.targetUnitId ? this._actor(order.targetUnitId) : this._players().find(player=>order.targetPlayerId==='player2' ? player.isPlayer2===true : player.isPlayer2!==true);
      const faction=target?.factionId ?? this.simulation.config.playerFaction;
      if(!target || !(target.hp>0) || this.simulation.relationship(unit.factionId,faction)!=='allied')return refused('living_allied_patient_required');
      const maximum=target.maxHp??target.maxHP??target.maxHealth??1000;
      if(target.hp>=maximum)return refused('patient_not_wounded');
      if(!this._inRange(actor,target,ability.range) || !this._clear(actor,target))return refused('patient_out_of_reach');
      const amount=Math.min(110,maximum-target.hp);target.hp+=amount;
      if(order.targetUnitId)this.simulation.syncUnit(order.targetUnitId,{hp:target.hp});
      effect={type:'heal',amount,targetUnitId:order.targetUnitId??order.targetPlayerId??'player1'};
    } else if(order.type==='repair' || order.type==='sabotage') {
      const front=this.simulation.fronts.get(order.frontId),target=front&&this._pointTarget(front.position);
      if(!front || !target || !this._inRange(actor,target,ability.range) || !this._clear(actor,target))return refused('base_out_of_reach');
      if(order.type==='repair') {
        if(this.simulation.relationship(unit.factionId,front.owner)!=='allied' || front.sourceHP<=0 || front.sourceHP>=front.baseHP)return refused('damaged_allied_live_source_required');
        const amount=Math.min(180,front.baseHP-front.sourceHP);front.sourceHP+=amount;effect={type:'repair',frontId:front.id,amount};
      } else {
        if(!front.owner || !this.simulation.areHostile(unit.factionId,front.owner) || front.sourceHP<=0)return refused('hostile_live_source_required');
        const before=front.sourceHP;if(!this.simulation.damageSource(front.id,240,'companion_sabotage'))return refused('sabotage_unavailable');effect={type:'sabotage',frontId:front.id,amount:before-front.sourceHP};
      }
    } else if(order.type==='recon') {
      const front=this.simulation.fronts.get(order.frontId),target=front&&this._pointTarget(front.position);
      if(!front || !target || !this._inRange(actor,target,ability.range))return refused('recon_front_out_of_range');
      const groups=[...this.simulation.groups.values()].filter(group=>group.frontId===front.id && this.simulation.areHostile(unit.factionId,group.factionId) && group.units.some(id=>this.simulation.getUnit(id).hp>0));
      if(!groups.length)return refused('no_hostile_group_to_report');
      for(const group of groups) { if(this.simulation.revealGroup)this.simulation.revealGroup(group.id,{duration:20,source:unitId});else {group.revealedUntil=this.time+20;group.lastSeenAt=this.time;group.reportAge=0;group.reportPosition=[...group.position];} }
      effect={type:'recon',groupIds:groups.map(group=>group.id),expiresAt:this.time+20};
    } else {
      const group=this.simulation.groups.get(order.targetGroupId),target=group&&this._pointTarget(group.position);
      if(!group || !target || !this.simulation.areHostile(unit.factionId,group.factionId) || !group.units.some(id=>this.simulation.getUnit(id).hp>0))return refused('hostile_group_required');
      if(!this._inRange(actor,target,ability.range) || !this._clear(actor,target))return refused('suppression_target_out_of_reach');
      const hitUnitIds=group.units.filter(id=>this.simulation.getUnit(id).hp>0);
      applyFormationImpact(this.simulation,{groupId:group.id,kind:'support_fire',sourceFaction:unit.factionId,attackId:`companion:${unitId}:${entry.uses}`,hitUnitIds});
      group.suppressedUntil=Math.max(group.suppressedUntil??0,this.time+8);effect={type:'suppress',targetGroupId:group.id,expiresAt:group.suppressedUntil};
    }
    entry.charges[order.type]--;entry.cooldowns[order.type]=this.time+ability.cooldown;entry.uses++;
    const event={...effect,unitId,time:this.time,chargesRemaining:entry.charges[order.type]};this.events.push(event);if(this.events.length>64)this.events.shift();
    this.simulation._emit?.('companion_ability',event,1);return {accepted:true,effect:copy(event)};
  }
  update(delta){
    if(!Number.isFinite(delta)||delta<=0||this.simulation.paused||this.simulation.disposed)return false;
    for(const entry of this.roster.values()) {
      this._applyKit(entry);const actor=this._actor(entry.unitId);if(!entry.pending) {if(actor)actor.companionOrderTarget=null;continue;}
      if(this.time>entry.pending.expiresAt || this.simulation.getUnit(entry.unitId)?.hp<=0){delete entry.pending;if(actor)actor.companionOrderTarget=null;continue;}
      if(!actor)continue;
      const result=this.command(entry.unitId,entry.pending.order);
      if(result.accepted){delete entry.pending;actor.companionOrderTarget=null;continue;}
      if(['ability_cooling_down','patient_out_of_reach','base_out_of_reach','recon_front_out_of_range','suppression_target_out_of_reach','equipped_active_companion_required'].includes(result.reason)) {
        const target=this._orderTarget(entry.pending.order),position=this._position(target);
        actor.companionOrderTarget=position ? [position.x,position.z] : null;
        actor.companionOrderRange=target && !this._clear(actor,target) && entry.pending.order.type!=='recon' ? .9 : ABILITIES[entry.pending.order.type].range*.8;
      } else {delete entry.pending;actor.companionOrderTarget=null;}
    }
    return true;
  }
  getState(){return {version:1,operationId:this.simulation.config.id,time:this.time,companions:[...this.roster.values()].map(copy),events:copy(this.events)};}
  serialize(){return this.getState();}
  restore(saved) {
    if(saved?.version!==1 || saved.operationId!==this.simulation.config.id || !Array.isArray(saved.companions))throw new TypeError('Companion checkpoint belongs to another operation');
    const restored=new Map();
    for(const entry of saved.companions) {
      const unit=this.simulation.getUnit(entry.unitId),kit=COMPANION_KITS[entry.kitId];
      if(!unit || restored.has(entry.unitId) || !kit || !Array.isArray(entry.allowedRoles) || !entry.allowedRoles.includes(kit.role) || entry.allowedRoles.some(role=>!roles.has(role)) || !Number.isInteger(entry.uses) || entry.uses<0)throw new TypeError('Invalid companion checkpoint profile');
      for(const [ability,count] of Object.entries(entry.charges??{}))if(!ABILITIES[ability] || !Number.isInteger(count) || count<0 || count>ABILITIES[ability].charges)throw new TypeError('Invalid finite companion stock');
      for(const time of Object.values(entry.cooldowns??{}))if(!Number.isFinite(time)||time<0)throw new TypeError('Invalid companion cooldown');
      if(entry.pending && (!COMPANION_KITS[entry.kitId].abilities.includes(entry.pending.order?.type) || !Number.isFinite(entry.pending.enqueuedAt) || !Number.isFinite(entry.pending.expiresAt) || entry.pending.enqueuedAt<0 || entry.pending.expiresAt<entry.pending.enqueuedAt || entry.pending.expiresAt-entry.pending.enqueuedAt>60))throw new TypeError('Invalid pending companion order');
      const profile=this.simulation.profiles.get(unit.profileId);
      if(unit.uniqueId&&!profile.companionRoles || profile.companionRoles&&entry.allowedRoles.some(role=>!profile.companionRoles.includes(role)) || entry.role!==kit.role)throw new TypeError('Companion checkpoint exceeds its source profile');
      restored.set(entry.unitId,copy(entry));
    }
    this.roster=restored;this.events=copy(saved.events??[]).slice(-64);for(const entry of restored.values())this._applyKit(entry);return true;
  }
}
