import { mat4, Mat4 } from 'ts-gl-matrix';
import { Prefab, LoadPrefab, GLContext, Shader, ShowError, BindUniform, UNIFORM_TYPES, DrawPrefab, } from "./renderer.ts";

export interface PrefabTree {
  id: string, // A unique identifier for the object.
  transform: Mat4, // The transform describing the PrefabTree in global space.
  prefab?: Prefab, // The prefab for leaf nodes.
  children?: PrefabTree[], // Child sub-PrefabTrees. Currently Unimplemented.
}
export interface Scene {
  id: string, // A unique identifier for the scene.
  worldObjects: PrefabTree[], // A list of all world objects in the scene.
};

// Loads a scene from a JSON file.
//
// The JSON file should have the following schema:
// { 
//   "worldObjects": {
//     "url": "string",
//     "transform": {
//       "translation": [float, float, float], // Position in world space.
//       "rotation": [float, float, float], // Euler angles of rotation (degrees).
//       "scale": [float, float, float], // How to scale the object.
//     },
// }
export async function LoadScene(
    glContext: GLContext,
    shader: Shader,
    url: string,
): Promise<Scene | null> {
  const response = await fetch(`${url}`);
  if (!response.ok) {
    ShowError(`Error requesting ${url}: ${response}`);
    return null;
  }
  const json = await response.json();
  const prefabPromises: Promise<PrefabTree>[] = [];
  for (let i = 0; i < json.worldObjects.length; i++) {
    prefabPromises.push(new Promise(async (res, rej) => {
      const spec = json.worldObjects[i];
      const prefab = await glContext.prefabs.get({shader, url: spec.url});
      if (!prefab) {
        rej("Bad prefab");
        return;
      }
      const modelMatrix = mat4.create();
      mat4.translate(modelMatrix, modelMatrix, spec.transform.translation);
      mat4.rotate(modelMatrix, modelMatrix, spec.transform.rotation[0], [0, 1, 0]);
      mat4.rotate(modelMatrix, modelMatrix, spec.transform.rotation[1], [0, 0, 1]);
      mat4.rotate(modelMatrix, modelMatrix, spec.transform.rotation[2], [1, 0, 0]);
      mat4.scale(modelMatrix, modelMatrix, spec.transform.scale);
      res({
        id: `${url}-${i}`,
        transform: modelMatrix,
        prefab,
        });
    }));
  }
  const prefabs: PrefabTree[] = await Promise.all(prefabPromises);
  return {
    id: url,
    worldObjects: prefabs,
  };
}

export function BindScene(
  glContext: GLContext,
  shader: Shader,
  scene: Scene,
): void {
  for (let i = 0; i < scene.worldObjects.length; i++) {
    BindUniform(
      glContext,
      shader,
      {
        label: "uModelViewMatrix",
        value: scene.worldObjects[i].transform,
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    DrawPrefab(glContext, scene.worldObjects[i].prefab!);
  }
}

