/* Optional mouse-orbit camera for solo play (HW-DEC-94). Off by default: the v70 fixed
 * camera stays the reference, and local co-op on one keyboard always keeps it.
 * Yaw 0 reproduces the fixed offset exactly, so enabling it changes nothing until the mouse moves. */
export const FIXED_CAMERA_OFFSET = Object.freeze({ x: 0, y: 10, z: 16 });
const STORAGE_KEY = 'yautja-mouse-camera';

export class MouseCamera {
  constructor({ storage = null, sensitivity = 0.0025 } = {}) {
    this.storage = storage; this.sensitivity = sensitivity; this.yaw = 0;
    let saved = null; try { saved = storage?.getItem(STORAGE_KEY); } catch {}
    this.enabled = saved === 'on';
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled); if (!this.enabled) this.yaw = 0;
    try { this.storage?.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off'); } catch {}
    return this.enabled;
  }

  /** Whether the orbit applies now: enabled, and not shared-keyboard co-op. */
  active(isCoOp) { return this.enabled && !isCoOp; }

  onMouseMove(movementX) {
    if (!this.enabled || !Number.isFinite(movementX)) return this.yaw;
    this.yaw = Math.atan2(Math.sin(this.yaw - movementX * this.sensitivity), Math.cos(this.yaw - movementX * this.sensitivity));
    return this.yaw;
  }

  /** Camera offset from the hunter, the fixed v70 offset turned by the yaw. */
  offset(isCoOp = false) {
    const yaw = this.active(isCoOp) ? this.yaw : 0, c = Math.cos(yaw), s = Math.sin(yaw);
    return { x: FIXED_CAMERA_OFFSET.x * c + FIXED_CAMERA_OFFSET.z * s, y: FIXED_CAMERA_OFFSET.y, z: -FIXED_CAMERA_OFFSET.x * s + FIXED_CAMERA_OFFSET.z * c };
  }

  /** Turns a screen-relative move (x right, z toward the camera) into world space. */
  rotateMove(move, isCoOp = false) {
    if (!this.active(isCoOp)) return move;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), x = move.x, z = move.z;
    move.x = x * c + z * s; move.z = -x * s + z * c;
    return move;
  }
}
