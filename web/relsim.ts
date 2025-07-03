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
  LoadScene, BindScene
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

  const scene = await LoadScene(glContext, shaderProgram, "scenes/city.json");
  if (!scene) {
    ShowError("Failed to load scene");
    return;
  }

  const camera = NewCamera(vec3.create(), 0, 0);

  const controller = NewPlayerController(document, camera);

  const render = async () => {
    ClearCanvas(glContext);
    // Set up uniforms
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = glContext.width / glContext.height;
    const zNear = 0.1;
    const zFar = 100.0;
      
    const projectionMatrix = mat4.create();


    // note: trix.js always has the first argument
    // as the destination to receive the result.
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);


    /*
    for (let i=0; i < cubes.length; i++) {
    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
      const modelViewMatrix = mat4.create();

      // Now move the drawing position a bit to where we want to
      // start drawing the square.
      mat4.translate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        [-1 + i * 0.2, 0.0, -6.0]
      ); // amount to translate

      mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to rotate
        cubeRotation, // amount to rotate in radians
        [0, 0, 1]
      ); // axis to rotate around (Z)
      mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to rotate
        cubeRotation * 0.7, // amount to rotate in radians
        [0, 1, 0]
      ); // axis to rotate around (Y)
      mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to rotate
        cubeRotation * 0.3, // amount to rotate in radians
        [1, 0, 0]
      ); // axis to rotate around (X)





      BindUniform(
        glContext,
        shaderProgram,
        {
          label: "uModelViewMatrix",
          value: modelViewMatrix,
          typeHint: UNIFORM_TYPES.MAT4,
        }
      );
      */
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
          value: camera.ViewMatrix(),
          typeHint: UNIFORM_TYPES.MAT4,
        }
      );
      BindScene(glContext, shaderProgram, scene);

    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
  // await render(0);
  



}

window.addEventListener('load', main);
