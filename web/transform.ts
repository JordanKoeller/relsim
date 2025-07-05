
import { vec3, vec4, Vec3, Vec4, Mat4, mat4, quat, Quat} from 'ts-gl-matrix';

// Represents an arbitrary transformation.
// The transform is kept as separate rotation, translation, and scale components
// to work around the non-commutative nature of rotations.
export interface Transform {
  rotation: Quat,
  translation: Vec3,
  scale: Vec3

  Add(other: Transform): Transform,
  Scale(factor: number): Transform,

  Matrix(): Mat4,
}

export function NewTransform(
    {translation, rotation, scale}:
    {translation?: Vec3, rotation?: Quat, scale?: Vec3}
): Transform {
  const t: Partial<Transform> = {};
  if (translation) {
    t.translation = translation;
  } else {
  t.translation = vec3.fromValues(0, 0, 0);
  }
  if (rotation) {
    t.rotation = rotation;
  } else {
    t.rotation = quat.create();
  }
  if (scale) {
    t.scale = scale;
  } else {
    t.scale = vec3.fromValues(1,1,1);
  }

  t.Add = (other: Transform) => Transform {
    return other;
  }
  t.Scale(other: number) => Transform {
    return t;
  }
  t.Matrix = () => Mat4 {
    const matrix = mat4.create();
    mat4.scale(matrix, matrix, t.scale);
    mat4.rotate(matrix, matrix, t.rotation);
    mat4.translate(matrix, matrix, t.translation);
    return matrix;
  }

  return t;

  
}
