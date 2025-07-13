import { vec2, mat2, mat3, vec3, vec4, mat4 } from 'ts-gl-matrix';

import {
  GetGlContext,
  CreateShaderProgram,
  ShowError,
  CreateStaticBuffer,
  CreateTexture,
  CreateTextureFromUrl,
  BindUniform,
  ClearCanvas,
  DrawMesh,
  UNIFORM_TYPES,
  LoadPrefab,
  DrawPrefab,
} from './renderer.ts';
import {
  LoadScene, BindScene, LoadCityGrid,
} from "./scene.ts";
import {
  Camera, NewCamera, PlayerController, NewPlayerController
} from './player-controller.ts';

const VERTEX_SHADER_CODE = `#version 300 es
precision mediump float;

in vec3 aVertexPosition;
in vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 fragColor;
out vec2 vTextureCoord;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
  vTextureCoord = aTextureCoord;
}
`;

const FRAGMENT_SHADER_CODE = `#version 300 es
precision mediump float;

in vec3 fragColor;
in vec2 vTextureCoord;

uniform sampler2D uSampler;

out vec4 outputColor;

void main() {
  outputColor = texture(uSampler, vTextureCoord);
}
`;

const SKYBOX_VERTEX_SHADER = `#version 300 es
precision mediump float;

in vec3 aPos;

out vec3 uvw;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

void main()
{
    uvw = vec3(aPos.x, -aPos.y, aPos.z);
    mat4 myView = uViewMatrix;
    myView[0].w = 0.0;
    myView[1].w = 0.0;
    myView[2].w = 0.0;
    myView[3] = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 pos = uProjectionMatrix * myView * vec4(aPos, 1.0);
    gl_Position = pos.xyww;
}
`
const SKYBOX_FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 uvw;

out vec4 FragColor;

uniform samplerCube uCubemap;
uniform float uGamma;


vec3 gamma_correct(vec3 rgb) {
    return pow(rgb, vec3(1.0/uGamma));
}

void main()
{
  FragColor = vec4(gamma_correct(texture(uCubemap, uvw).xyz), 1.0);
}
`



async function main() {
  const glContext = GetGlContext();
  if (!glContext) {
    ShowError("Failed to create GlContext");
    return;
  }

  const shaderProgram = CreateShaderProgram(glContext.gl, {
    vertexShader: VERTEX_SHADER_CODE,
    fragmentShader: FRAGMENT_SHADER_CODE,
  });
  if (!shaderProgram) {
    ShowError("Failed to create ShaderProgram");
    return;
  }

  const skyboxProgram = CreateShaderProgram(glContext.gl, {
    vertexShader: SKYBOX_VERTEX_SHADER,
    fragmentShader: SKYBOX_FRAGMENT_SHADER,
  });
  if (!skyboxProgram) {
    ShowError("Failed to create SkyboxProgram");
    return;
  }

  // const scene = await LoadScene(glContext, shaderProgram, "scenes/city.json");
  //
  /*
  0000000
  0000000
  00X0X00
  0000000
  00X0X00
  0000000
  0000000
   */
  const scene = await LoadCityGrid(glContext, shaderProgram, [7, 7], [
    [2, 2],
    [4, 2],
    [2, 4],
    [4, 4],
  ]);
  if (!scene) {
    ShowError("Failed to load scene");
    return;
  }

  const skybox = await LoadPrefab(glContext.gl, skyboxProgram, "/obj/skybox");

  const camera = NewCamera(vec3.fromValues(30, -1, 6), 90, 0);

  const controller = NewPlayerController(document.body, camera);

  let start = undefined;

  const render = (timestamp) => {
    if (start === undefined) {
      start = timestamp;
    }
    const elapsed = (timestamp - start) / 1000;
    start = timestamp;

    // Set up uniforms
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = glContext.width / glContext.height;
    const zNear = 0.1;
    const zFar = 100.0;
      
    const projectionMatrix = mat4.create();


    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    controller.Update(elapsed);

    const velocityBox = document.getElementById("velocity");
    velocityBox.innerText = `${controller.Beta()}`;

    const positionBox = document.getElementById("position");
    positionBox.innerText = `${controller.Camera.Position}`;

    const rotation = document.getElementById("rotation");
    rotation.innerText = `${controller.Camera.Yaw}`;

    ClearCanvas(glContext);
    shaderProgram.use();
    BindUniform(
      glContext,
      shaderProgram,
      {
        label: "uProjectionMatrix",
        value: projectionMatrix,
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    BindUniform(
      glContext,
      shaderProgram,
      {
        label: "uViewMatrix",
        value: controller.ViewMatrix(),
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    BindScene(glContext, shaderProgram, scene);


    // Draw the skybox.
    skyboxProgram.use();
    BindUniform(
      glContext,
      skyboxProgram,
      {
        label: "uProjectionMatrix",
        value: projectionMatrix,
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    BindUniform(
      glContext,
      skyboxProgram,
      {
        label: "uViewMatrix",
        value: controller.ViewMatrix(),
        typeHint: UNIFORM_TYPES.MAT4,
      }
    );
    DrawPrefab(glContext, skybox);

    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}


window.addEventListener('load', main);
