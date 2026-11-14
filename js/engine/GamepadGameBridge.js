import * as THREE from 'three';
import {GamepadControls,MenuFocusController,GAMEPAD_HINTS} from './GamepadControls.js';
import {PlayerDodge} from './PlayerDodge.js';

const visibleRoot = root => Boolean(root && !root.hidden && root.isConnected !== false && !root.classList?.contains('hidden') && root.getAttribute?.('aria-hidden') !== 'true' && !root.closest?.('[hidden], [inert], .hidden'));

/** Routes physical controller actions to the same admissions as keyboard/UI. */
export class GamepadGameBridge {
 constructor(game,{getGamepads}={}){this.game=game;this.moves=[{x:0,y:0},{x:0,y:0}];this.looks=[{x:0,y:0},{x:0,y:0}];this.sprints=[false,false];this.charges=[0,0];this.vehicleFire=[false,false];this.inputMode='keyboard';this.dodge=new PlayerDodge(game.env);
  this.focus=new MenuFocusController({getRoot:()=>this.uiRoot(),document:globalThis.document,onBack:()=>this.back(),onInputMode:mode=>this.setInputMode(mode)});
  this.controls=new GamepadControls({getGamepads,onMove:(index,stick)=>this.moves[index]=stick,onLook:(index,stick)=>this.looks[index]=stick,onNavigate:(_index,direction)=>this.focus.navigate(direction),onRadial:(index,stick)=>this.radial(index,stick),onAction:(index,action,details)=>this.action(index,action,details),onConnection:(_index,status)=>{if(!status.connected&&game.isPlaying&&!game.isPaused)game.togglePause(true);},onInputMode:mode=>this.setInputMode(mode)});
  this.hints=document.createElement('p');this.hints.id='gamepad-hints';this.hints.className='gamepad-hints';document.body.append(this.hints);
 }
 player(index){return index?this.game.player2:this.game.player;}
 setInputMode(mode){this.inputMode=mode;document.body.classList.toggle('gamepad-input',mode==='gamepad');}
 context(){const game=this.game;if(game.weaponWheel?.isOpen)return'radial';if(game._tacticalModal||visibleRoot(game.commandMap?.root))return game.isPaused?'paused':'menu';if(!game.isPlaying||game.isPaused||game.photoMode?.isActive)return game.isPaused?'paused':'menu';const dialog=globalThis.document?.querySelector?.('[role="dialog"][aria-modal="true"]:not(.hidden):not([aria-hidden="true"])');return visibleRoot(dialog)?'menu':'gameplay';}
 uiRoot(){
  const game=this.game,doc=globalThis.document;if(!doc)return null;
  if(game.weaponWheel?.isOpen&&visibleRoot(game.weaponWheel.overlay))return game.weaponWheel.overlay;
  if(game._tacticalModal){const modal=doc.getElementById?.(game._tacticalModal.id);if(visibleRoot(modal))return modal;}
  if(visibleRoot(game.commandMap?.root))return game.commandMap.root;
  const dialogs=[...(doc.querySelectorAll?.('[role="dialog"][aria-modal="true"]')??[])].filter(visibleRoot);if(dialogs.length)return dialogs.at(-1);
  if(game.photoMode?.isActive&&visibleRoot(game.photoMode.hud))return game.photoMode.hud;
  if(game.isPlaying&&!game.isPaused&&!game.photoMode?.isActive)return null;
  const screens=[...(doc.querySelectorAll?.('.ui-screen')??[])].filter(node=>visibleRoot(node)&&node!==game.ui?.inGameHud);if(screens.length)return screens.at(-1);
  const briefing=game.operationBriefing?.root;if(visibleRoot(briefing)){const parent=briefing.closest?.('.ui-screen');return visibleRoot(parent)?parent:briefing;}
  return null;
 }
 poll(delta){const context=this.context();this.controls.update(delta,{context,playerCount:this.game.isCoOp?2:1,enabled:!document.hidden&&(typeof document.hasFocus!=='function'||document.hasFocus())});this.hints.textContent=GAMEPAD_HINTS[context==='gameplay'?'gameplay':context==='radial'?'radial':'menu'].join(' · ').replace('RS : caméra','RS : visée');}
 movement(index){const player=this.player(index);if(player?.isDodging)return{x:0,y:0,magnitude:0};return this.moves[index]??{x:0,y:0,magnitude:0};}
 movementScale(index,keyboard){const stick=this.movement(index);return keyboard?1:Math.hypot(stick.x,stick.y)>0?Math.min(1,Math.hypot(stick.x,stick.y)):1;}
 applyAim(index){const player=this.player(index);if(!player)return;const target=player.targetLockEnemy;if(target&&target.hp>0&&target.mesh&&this.game.env.hasLineOfSight?.(player.position.clone().add(new THREE.Vector3(0,1.5,0)),target.mesh.position.clone().add(new THREE.Vector3(0,1.5,0)))!==false){const delta=target.mesh.position.clone().sub(player.position);player.rotationY=Math.atan2(delta.x,delta.z);return;}if(target)player.targetLockEnemy=null;const look=this.looks[index];if(look&&Math.hypot(look.x,look.y)>.2)player.rotationY=Math.atan2(look.x,-look.y);}
 updateGameplay(delta){this.dodge.update(delta);for(let i=0;i<2;i++){const player=this.player(i);if(!player)continue;if(player.isChargingPlasma&&i===1)player.plasmaChargeTime+=delta;if(this.sprints[i]&&Math.hypot(this.moves[i].x,this.moves[i].y)>.1&&player.stamina>0){player.stamina=Math.max(0,player.stamina-6*delta);player.isSprinting=true;}else player.isSprinting=false;}}
 speedScale(index){return this.player(index)?.isSprinting?1.3:1;}
 back(){const game=this.game;if(game.weaponWheel?.isOpen){game.weaponWheel.close();this.focus.reset();return true;}if(game._tacticalModal){game.closeTacticalModal();this.focus.reset();return true;}if(game.photoMode?.isActive){game.photoMode.toggle(game.player?.position);this.focus.reset();return true;}if(game.isPlaying){game.togglePause(!game.isPaused);return true;}const root=this.uiRoot();const buttons=[...(root?.querySelectorAll?.('button')??[])];const button=buttons.find(node=>!node.disabled&&!node.classList?.contains('hidden')&&(/^(btn-back|btn-close)/.test(node.id??'')||node.hasAttribute?.('data-close')));if(button)button.click?.();else if(game.ui?.mainMenu)game.ui.showScreen?.(game.ui.mainMenu);this.focus.reset();return Boolean(button||game.ui?.mainMenu);}
 radial(index,stick){const game=this.game;if(!game.weaponWheel.isOpen)return;game.weaponWheel.inputOwner=this.player(index);const items=[...game.weaponWheel.wheelContainer.querySelectorAll('button')];if(!items.length)return;const angle=(stick.angle+Math.PI*2)%(Math.PI*2),choice=items[Math.round(angle/(Math.PI*2)*items.length)%items.length];choice.focus();}
 lock(player){if(player.targetLockEnemy){player.targetLockEnemy=null;return;}const game=this.game,simulation=game.battleSimulation;const actors=simulation?[...game.battleBridge.actors.values()].map(entry=>entry.actor):[...game.horde.aliens,...game.synthetics.androids,...game.marines.marines,game.bosses.activeBoss,game.badBlood.badBlood];player.targetLockEnemy=actors.filter(actor=>actor?.hp>0&&actor.mesh&&(!simulation||simulation.areHostile(simulation.config.playerFaction,actor.factionId))&&actor.mesh.position.distanceTo(player.position)<65&&game.env.hasLineOfSight?.(player.position.clone().add(new THREE.Vector3(0,1.5,0)),actor.mesh.position.clone().add(new THREE.Vector3(0,1.5,0)))!==false).sort((a,b)=>a.mesh.position.distanceToSquared(player.position)-b.mesh.position.distanceToSquared(player.position))[0]??null;}
 ranged(index,charged){return this.game.firePlasmaCannon(charged,this.player(index));}
 action(index,action,{phase='pressed',reason}={}){const game=this.game,player=this.player(index),pressed=phase==='pressed';if(action==='guard'&&!pressed){if(player?.isBlocking)player.toggleShieldBlock();return;}if(action==='sprint'&&!pressed){this.sprints[index]=false;return;}if(action==='ranged'&&!pressed){if(this.vehicleFire[index]){this.vehicleFire[index]=false;return;}if(player){const charge=player.plasmaChargeTime;player.isChargingPlasma=false;if(!reason&&game.isPlaying&&!game.isPaused&&!game.dropPod.isActive&&!game.photoMode.isActive&&!game.weaponWheel.isOpen&&player.hp>0)this.ranged(index,charge>=.55);}return;}
  if(!pressed)return;
  if(action==='confirm'){this.focus.confirm();return;}if(action==='back'){this.focus.back();return;}if(action==='tabPrevious'||action==='tabNext'){this.focus.cyclePanel(action==='tabPrevious'?-1:1);return;}
  if(action==='pause'){if(game._tacticalModal)game.closeTacticalModal();else if(game.isPlaying)game.togglePause(!game.isPaused);return;}
  if(this.context()!=='gameplay'||!game.isPlaying||game.isPaused||game.dropPod.isActive||!player||player.hp<=0)return;
  if(game.operationTransport?.isPassenger(player)||(index===0&&game.skimmer.isMounted)){if(action==='ranged')this.vehicleFire[index]=true;else if(action==='interact')game.handlePlayerInteraction(player);else if(action==='map')game.openCommandMap();return;}
  if(game.badBlood.isDueling){const key={vision:'KeyW',heal:'KeyS',cloak:'KeyA',musou:'KeyD'}[action];if(key)game.badBlood.handleDuelInput(key,game.badBlood.duelTarget??player,game.ui,game.gore,game.particles,game);return;}
  if(player.isFacehuggerLatched||player.isRoyalFacehuggerLatched){if(action==='jump'||action==='interact'){if(player.isRoyalFacehuggerLatched)game.horde.struggleRoyalFacehugger(player);else player.struggleQTE();}return;}
  if(action==='light'||action==='heavy'){if(index===0)game[action==='light'?'performLightAttack':'performHeavyAttack']();else game.performCoopAttack(action==='light'?'Enter':'Numpad0');}
  else if(action==='jump')player.pounceLeap();else if(action==='dodge')this.dodge.start(player,this.moves[index]);
  else if(action==='guard'){if(!player.isBlocking)player.toggleShieldBlock();}else if(action==='sprint')this.sprints[index]=true;
  else if(action==='ranged'){player.plasmaChargeTime=0;player.isChargingPlasma=player.getWeaponState().rangedResource!=='bolts';}
  else if(action==='interact')game.handlePlayerInteraction(player);
  else if(action==='radial'){game.weaponWheel.inputOwner=player;game.weaponWheel.open();}
  else if(action==='map')game.openCommandMap();else if(action==='lock')this.lock(player);
  else if(action==='vision'){const mode=player.cycleVisionMode();if(index===0)game.updateVisionOverlays(mode);}
  else if(action==='heal'){if(player.useMedicomp())game.particles.emitMedicompSteam(player.position,24);}
  else if(action==='cloak')player.toggleCloak();else if(action==='musou'&&player.triggerMusouOverload()){if(index===0)game.executeMusouOverload();else{const attack={origin:player.position,radius:15,damage:player.meleeDamage*5,type:'musou'};game.registerHits(game.horde.checkMeleeHits(attack));game.synthetics.checkHits(attack);if(game.bosses.activeBoss?.mesh.position.distanceTo(player.position)<15)game.bosses.takeDamage(attack.damage);}}
 }
 reset(){this.controls.reset();this.focus.reset();this.moves=[{x:0,y:0},{x:0,y:0}];this.looks=[{x:0,y:0},{x:0,y:0}];this.sprints=[false,false];this.vehicleFire=[false,false];this.dodge.reset();}
 dispose(){this.reset();this.controls.dispose();this.focus.dispose();this.hints.remove();}
}
