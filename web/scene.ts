import { mat4, Mat4, vec3 } from 'ts-gl-matrix';
import { Prefab, LoadPrefab, GLContext, Shader, ShowError, BindUniform, UNIFORM_TYPES, DrawPrefab, } from "./renderer.ts";

const BUILDINGS = [
  "building_1",
  "building_2",
  "building_3",
  "building_4",
];

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
    DrawPrefabTree(glContext, shader, scene.worldObjects[i]);
  }
}

export function DrawPrefabTree(
  glContext: GLContext,
  shader: Shader,
  prefabTree: PrefabTree,
  transform: Mat4 | undefined,
): void {
  let newTransform = mat4.create();
  if (transform) {
    mat4.mul(newTransform, transform, prefabTree.transform);
  } else {
    newTransform = prefabTree.transform;
  }
  if (prefabTree.children) {
    for (let i=0; i < prefabTree.children.length; i++) {
      DrawPrefabTree(glContext, shader, prefabTree.children[i], newTransform);
    }
  }
  if (prefabTree.prefab) {
    BindUniform(
      glContext,
      shader,
      {
        label: "uModelViewMatrix",
        value: newTransform,
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    DrawPrefab(glContext, prefabTree.prefab);
  }

}

function toRadians(degrees: number): number {
  const ret = degrees * Math.PI / 180;
  return ret;
}

function isBuilding(grid: [string, number][][], i: number, j: number): boolean {
  return grid[i][j][0].includes("building_");
}

function getStreetTile(grid: [string, number][][], i: number, j: number): [string, number] {
  let pattern = "";
  if (isBuilding(grid, i-1, j)) {
    pattern += "N";
  }
  if (isBuilding(grid, i, j+1)) {
    pattern += "E";
  }
  if (isBuilding(grid, i+1, j)) {
    pattern += "S";
  }
  if (isBuilding(grid, i, j-1)) {
    pattern += "W";
  }
  switch (pattern) {
    case "": return ["intersection", 0];
    case "N": return ["tee", 180];
    case "E": return ["tee", 270];
    case "S": return ["tee", 0];
    case "W": return ["tee", 90];
    case "NW": return ["bend", 90];
    case "NE": return ["bend", 180];
    case "ES": return ["bend", 270];
    case "SW": return ["bend", 0];
    case "NS": return ["road", 0];
    case "EW": return ["road", 90];
    case "NEW": return ["road", 0];
    case "ESW": return ["road", 90];
    case "NSW": return ["road", 0];
    default: return ["debug", 0];
  }
}

export async function LoadCityGrid(
  glContext: GLContext,
  shader: Shader,
  sceneDimensions: [number, number],
  buildingCoordinates: [number, number][],
): Scene {
  const coords = [...buildingCoordinates];
  for (let i=0; i < sceneDimensions[0]; i++) {
    coords.push([0, i]);
    coords.push([sceneDimensions[1] - 1, i]);
  }
  for (let i=0; i < sceneDimensions[1]; i++) {
    coords.push([i, 0]);
    coords.push([i, sceneDimensions[0] - 1]);
  }
  // Grid of (prefab_name, rotation)
  const grid: [string, number, Vec3][][] = Array.from(
    Array(sceneDimensions[0]),
    () => Array.from(Array(sceneDimensions[1]), () => ["", 0]));
  coords.forEach(elem => {
    const x = elem[0];
    const y = elem[1];
    grid[x][y] = [
      BUILDINGS[((x +1) * (y + 1) + 13) % BUILDINGS.length],
      0,
      vec3.fromValues(0.5, 0.5, 0.5)
    ];
  });

  for (let i=1; i < grid.length - 1; i++) {
    for (let j=1; j < grid[0].length - 1; j++) {
      if (isBuilding(grid, i, j)) {
        continue;
      }
      grid[i][j] = [...getStreetTile(grid, i, j), vec3.fromValues(0.5, 0.01, 0.5)];
    }
  }
  const worldObjects = [];
  grid.forEach((row, i) => {
    row.forEach((col, j) => {
      const [code, rotation, scale] = col;
      const modelMatrix = mat4.create();
      if (isBuilding(grid, i, j)) {
        mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(i, 0, j));
      } else {
        mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(i, -0.5, j));
      }
      mat4.rotate(modelMatrix, modelMatrix, toRadians(rotation), [0, 1, 0]);
      mat4.scale(modelMatrix, modelMatrix, scale);
      worldObjects.push(glContext.prefabs.get({shader, url: `/obj/${code}`})
        .then(prefab => ({
          id: `city-${i}-${j}`,
          transform: modelMatrix,
          prefab,
        })));
      });
    });

  const scale = mat4.create();
  mat4.scale(scale, scale, vec3.fromValues(10, 4, 10));
  return {
    id: "city",
    worldObjects: [
      {
        id: "city",
        transform: scale,
        children: await Promise.all(worldObjects),
      },
    ]
  };

}

