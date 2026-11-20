/* Physical visual arc for ONE previously allocated and projected
 * Extinction Facehugger. Neither damage nor new unit IDs are created here. */
export const CARRIER_FLIGHT_RULES=Object.freeze({
  duration:1,arcHeight:2.2,visualFidelity1to1Verified:false
});
export function advanceCarrierFacehuggerFlight(actor,delta){
  const f=actor?.carrierFlight;
  if(!f||!actor?.mesh?.position?.isVector3||
     !Number.isFinite(delta)||delta<0)return false;
  if(!(f.duration>0)||!f.start?.isVector3||!f.end?.isVector3){
    actor.carrierFlight=null;return false;
  }
  f.elapsed=Math.min(f.duration,f.elapsed+delta);
  const t=f.elapsed/f.duration;
  actor.mesh.position.copy(f.start).lerp(f.end,t);
  actor.mesh.position.y+=Math.sin(Math.PI*t)*CARRIER_FLIGHT_RULES.arcHeight;
  if(t>=1)actor.carrierFlight=null;
  return true;
}
