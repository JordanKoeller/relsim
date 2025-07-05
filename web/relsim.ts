import { vec2, mat2, mat3, vec3, vec4, mat4 } from "ts-gl-matrix";

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
} from "./renderer.ts";
import { LoadScene, BindScene } from "./scene.ts";
import {
	Camera,
	NewCamera,
	PlayerController,
	NewPlayerController,
} from "./player-controller.ts";

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

	const camera = NewCamera(vec3.create(), -90, 0);

	const controller = NewPlayerController(document, camera);

	let start = undefined;

	const render = (timestamp) => {
		if (start === undefined) {
			start = timestamp;
		}
		const elapsed = timestamp - start; // In ms

		// Set up uniforms
		const fieldOfView = (45 * Math.PI) / 180; // in radians
		const aspect = glContext.width / glContext.height;
		const zNear = 0.1;
		const zFar = 100.0;

		const projectionMatrix = mat4.create();

		mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
		controller.Update(elapsed);

		ClearCanvas(glContext);
		shaderProgram.use();
		BindUniform(glContext, shaderProgram, {
			label: "uProjectionMatrix",
			value: projectionMatrix,
			typeHint: UNIFORM_TYPES.MAT4,
		});
		BindUniform(glContext, shaderProgram, {
			label: "uViewMatrix",
			value: controller.ViewMatrix(),
			typeHint: UNIFORM_TYPES.MAT4,
		});
		BindScene(glContext, shaderProgram, scene);

		requestAnimationFrame(render);
	};
	requestAnimationFrame(render);
	// await render(0);
}

window.addEventListener("load", main);
