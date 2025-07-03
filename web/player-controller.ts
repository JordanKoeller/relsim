
import { vec3, vec4, Vec3, Vec4, Mat4, mat4, quat, Quat} from 'ts-gl-matrix';

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
    pitch: pitch,
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
      vec3.normalize(t.Front, t.Front);
      vec3.cross(t.Right, t.Front, t.WorldUp);
      vec3.cross(t.Up, t.Right, t.Front);
    },
  };
  t._FixCameraVectors();
  return t;
}


export interface PlayerController {
  GetTransform(): Mat4,
};

export function NewPlayerController(
    element: HTMLElement, camera: Camera): PlayerController {
  const sensitivity = 0.1;
  const t = {
    Camera: camera
  };
  element.addEventListener(
    "keydown",
    (event) => {
      switch (event.key) {
        case "w": {
          t.Camera.Translate(vec3.fromValues(0, 0, -sensitivity));
          break;
        }
        case "a": {
          t.Camera.Translate(vec3.fromValues(-sensitivity, 0, 0));
          break;
        }
        case "s": {
          t.Camera.Translate(vec3.fromValues(0, 0, sensitivity));
          break;
        }
        case "d": {
          t.Camera.Translate(vec3.fromValues(sensitivity, 0, 0));
          break;
        }
      }
    }
  );
  return t;
};

function ToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}
