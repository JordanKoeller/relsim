
import { Vec2, vec2, vec3, vec4, Vec3, Vec4, Mat4, mat4, quat, Quat} from 'ts-gl-matrix';

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
};

export function NewPlayerController(
    element: HTMLElement, camera: Camera): PlayerController {
  const sensitivity = 0.1;
  const movementVelocity = 0.01; // m/s
  const t = {
    // Current state of the Player.
    Camera: camera,
    velocity: vec3.fromValues(0, 0, 0),

    // Control variables below
    wPressed: false,
    aPressed: false,
    sPressed: false,
    dPressed: false,
    Update(dt: number): void {
      vec3.zero(t.velocity);
      if (t.wPressed) {
        vec3.add(t.velocity, t.velocity, t.Camera.Front);
      }
      if (t.sPressed) {
        vec3.sub(t.velocity, t.velocity, t.Camera.Front);
      }
      if (t.dPressed) {
        vec3.add(t.velocity, t.velocity, t.Camera.Right);
      }
      if (t.aPressed) {
        vec3.sub(t.velocity, t.velocity, t.Camera.Right);
      }
      vec3.scale(t.velocity, t.velocity, movementVelocity * dt / 1000);
      t.Camera.Translate(t.velocity);
    },
    ViewMatrix(): Mat4 {
      return camera.ViewMatrix();
    },

  };
  element.addEventListener(
    "keydown",
    (event) => {
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
      }
    }
  );
  element.addEventListener(
    "keyup",
    (event) => {
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
      }
    }
  );
  let mousePos: Vec2 | undefined = undefined;
  element.requestPointerLock();
  element.addEventListener(
    "mousemove",
    (event) => {
      if (mousePos === undefined) {
        mousePos = vec2.fromValues(event.movementX, event.movementY);
      }
      const delta = vec2.fromValues(event.movementX, event.movementY);
      vec2.sub(delta, delta, mousePos);
      // Flip delta since default camera is inverted.
      delta.y = -delta.y;
      t.Camera.Rotate(delta.x, delta.y);
      mousePos = vec2.fromValues(event.x, event.y);
    }
  );
  return t;
};

function ToRadians(degrees: number): number {
  const ret = degrees * Math.PI / 180;
  return ret;
}
