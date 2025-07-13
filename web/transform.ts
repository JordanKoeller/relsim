
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
  const t = {
    translation: translation ? translation : vec3.create(),
    rotation: rotation ? rotation : quat.create(),
    scale: scale ? scale : vec3.create(),
    Add(other: Transform): Transform {
      return other;
    },
    Scale(factor: number): Transform {
      return t;
    },
    Matrix(): Mat4 {
      const matrix = mat4.create();
      mat4.scale(matrix, matrix, t.scale);
      mat4.rotate(matrix, matrix, t.rotation);
      mat4.translate(matrix, matrix, t.translation);
      return matrix;
    },
  };
  return t;
}
