import { Vec2, vec2, vec3, vec4, Vec3, Vec4, Mat4, mat4, quat, Quat} from 'ts-gl-matrix';

export const C = 16; // m / s
const IMPULSE = 2;  // m / s^2
const DRAG_FACTOR = 0.0042;
const BRAKE_FACTOR = 0.2; // m / s

/*
 *
 * Impulse = D * V^2
 * let V = 15.5
 * 1 = D * 15.5 * 15.5
 * D = 1 / 15.5 / 15.5
 */

export interface Camera {
  // camera Attributes
  Position: Vec3,
  Front: Vec3,
  Up: Vec3,
  Right: Vec3,
  WorldUp: Vec3,
  // euler Angles
  Yaw: number,
  Pitch: number,
  Zoom: number,

  ViewMatrix(): Mat4,
  Translate(delta: Vec3): void,
  Rotate(yaw: number, pitch: number): void,
}

export function NewCamera(position: Vec3, yaw: number, pitch: number): Camera {
  const t = {
    Position: position,
    Front: vec3.fromValues(0, 0, -1),
    Up: vec3.fromValues(0, 1, 0),
    Right: vec3.fromValues(1, 0, 0),
    WorldUp: vec3.fromValues(0, 1, 0),
    Yaw: yaw,
    Pitch: pitch,
    Zoom: 45,

    ViewMatrix(): Mat4 {
      const ret = mat4.create();
      const facing = vec3.create();
      vec3.add(facing, t.Position, t.Front);
      mat4.lookAt(ret, t.Position, facing, t.Up);
      return ret;
    },
    Translate(delta: Vec3): void {
      vec3.add(t.Position, t.Position, delta);
    },
    Rotate(yaw: number, pitch: number): void {
      t.Yaw += yaw;
      t.Pitch += pitch;
      if (t.Pitch > 89.0) {
        t.Pitch = 89.0;
      }
      if (t.Pitch < -89.0) {
        t.Pitch = -89.0;
      }
      t._FixCameraVectors();
    },
    _FixCameraVectors(): void {
      const x = Math.cos(ToRadians(t.Yaw)) * Math.cos(ToRadians(t.Pitch));
      const y = Math.sin(ToRadians(t.Pitch));
      const z = Math.sin(ToRadians(t.Yaw)) * Math.cos(ToRadians(t.Pitch));
      t.Front = vec3.fromValues(x, y, z);
      vec3.normalize(t.Front, t.Front);
      vec3.cross(t.Right, t.Front, t.WorldUp);
      vec3.cross(t.Up, t.Right, t.Front);
    },
  };
  t._FixCameraVectors();
  return t;
}

export interface PlayerController {
  Update(dt: number), // Update the player by `dt` time elapsed.
  ViewMatrix(): Mat4, // Get the current ViewMatrix.
  Beta(): Vec3, // Get the current Velocity vector in units of C
};

export function NewPlayerController(
    element: HTMLElement, camera: Camera): PlayerController {
  const t = {
    // Current state of the Player.
    Camera: camera,
    Velocity: vec3.fromValues(0, 0, 0),
    Acceleration: vec3.fromValues(0, 0, 0),

    // Control variables below
    wPressed: false,
    aPressed: false,
    sPressed: false,
    dPressed: false,
    spacePressed: false,

    // Methods
    Update(dt: number): void {
      // The logic is as follows:
      //   1. Compute the correct Acceleration vector accounting for drag
      //   2. Update the position vector based on the computed acceleration and velocity.
      //   3. Update velocity vector based on the acceleration
      vec3.zero(t.Acceleration);
      const drag = vec3.create();
      vec3.normalize(drag, t.Velocity);
      const speed = vec3.magnitude(t.Velocity);
      vec3.scale(drag, drag, -DRAG_FACTOR * speed * speed);
      if (t.spacePressed) {
        const factor = speed - Math.min(BRAKE_FACTOR, speed);
        if (speed) {
        const scale = factor / speed;
        vec3.scale(t.Velocity, t.Velocity, scale);
        }
      } else {
        if (t.wPressed) {
          vec3.add(t.Acceleration, t.Acceleration, t.Camera.Front);
        }
        if (t.sPressed) {
          vec3.sub(t.Acceleration, t.Acceleration, t.Camera.Front);
        }
        if (t.dPressed) {
          vec3.add(t.Acceleration, t.Acceleration, t.Camera.Right);
        }
        if (t.aPressed) {
          vec3.sub(t.Acceleration, t.Acceleration, t.Camera.Right);
        }
        vec3.normalize(t.Acceleration, t.Acceleration);
        vec3.scale(t.Acceleration, t.Acceleration, IMPULSE);
        vec3.add(t.Acceleration, t.Acceleration, drag);
      }
      t.DoKinematics(dt);

    },
    ViewMatrix(): Mat4 {
      return camera.ViewMatrix();
    },
    Beta(): Vec3 {
      return vec3.fromValues(t.Velocity.x / C, t.Velocity.y / C, t.Velocity.z / C);
    },
    DoKinematics(dt: number) {
      const deltaR = vec3.create();
      const deltaR2 = vec3.create();
      const deltaV = vec3.create();
      vec3.scale(deltaR, t.Velocity, dt);
      vec3.scale(deltaR2, t.Acceleration, dt * dt / 2);
      vec3.add(deltaR, deltaR, deltaR2);
      t.Camera.Translate(deltaR);

      vec3.scaleAndAdd(t.Velocity, t.Velocity, t.Acceleration, dt);
      vec3.zero(t.Acceleration);
    }
  };
  const handlers = {
    keydown(event: Event): void {
      switch (event.key) {
        case "w": {
          t.wPressed = true;
          break;
        }
        case "a": {
          t.aPressed = true;
          break;
        }
        case "s": {
          t.sPressed = true;
          break;
        }
        case "d": {
          t.dPressed = true;
          break;
        }
        case "e": {
          t.spacePressed = true;
          break;
        }
      }
    },
    keyup(event: Event): void {
      switch (event.key) {
        case "w": {
          t.wPressed = false;
          break;
        }
        case "a": {
          t.aPressed = false;
          break;
        }
        case "s": {
          t.sPressed = false;
          break;
        }
        case "d": {
          t.dPressed = false;
          break;
        }
        case "e": {
          t.spacePressed = false;
          break;
        }
      }
    },
    mousemove(event: Event): void {
      const delta = vec2.fromValues(event.movementX * 0.2, event.movementY * 0.2);
      // Flip delta since default camera is inverted.
      delta.y = -delta.y;
      t.Camera.Rotate(delta.x, 0);
    }
  };
  element.addEventListener(
    "click",
    async (event) => {
      if (!document.pointerLockElement) {
        await element.requestPointerLock();
      }
    },
  );
  document.addEventListener(
    "pointerlockchange",
    (event) => {
      if (document.pointerLockElement) {
        // Locking 
        element.addEventListener("mousemove", handlers.mousemove);
        element.addEventListener("keydown", handlers.keydown);
        element.addEventListener("keyup", handlers.keyup);
      } else {
        // Unlocking
        element.removeEventListener("mousemove", handlers.mousemove);
        element.removeEventListener("keydown", handlers.keydown);
        element.removeEventListener("keyup", handlers.keyup);
      }
    }
  );
  return t;
};

function ToRadians(degrees: number): number {
  const ret = degrees * Math.PI / 180;
  return ret;
}
