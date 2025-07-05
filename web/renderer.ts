import { NewLRUCache, LRUCache } from "./asset-manager.ts";
import { vec2, mat2, mat3, vec3, vec4, mat4 } from "ts-gl-matrix";

export type GL = WebGLRenderingContext;
export type Image = HTMLImageElement;

/** Helper method to output an error message to the screen */
export function ShowError(errorText: string): void {
	const errorBoxDiv = document.getElementById("error-box")!;
	const errorSpan = document.createElement("p")!;
	errorSpan.innerText = errorText;
	errorBoxDiv.appendChild(errorSpan);
	console.error(errorText);
}

// Returns a manager for prefabs. The filepath is used as a key
export function NewTextureSlotCache(gl: GL): LRUCache<any, number> {
	return NewLRUCache(
		gl.MAX_TEXTURE_IMAGE_UNITS,
		(elem) => elem.id,
		(_, slot) => gl.TEXTURE0 + slot,
	);
}

// Returns a manager for prefabs. The filepath is used as a key
//
// The resultant manager expects arguments of {shader, url}.
export function NewPrefabCache(
	gl: GL,
): LRUCache<{ shader: Shader; url: string }, Promise<Prefab | null>> {
	return NewLRUCache(
		200,
		(elem) => elem.url,
		(elem) => LoadPrefab(gl, elem.shader, elem.url),
		() => {
			throw "Exceeded PrefabCache limit";
		},
	);
}

export interface Prefab {
	shader: Shader;
	uniforms: Record<string, Uniform>;
	mesh: Buffer;
}

// Loads a prefab from a JSON file.
//
// The JSON file should have the following schema:
// {
//   "uniforms": {"label": "string", "value": value, "typeHint": UNIFORM_TYPE}[],
//   "attributes": {"name": "string", "size": int}[],
//   "vertices": float[],
//   "indices": int[],
// }
//
// Args:
//   @shader:  - The shader program to use with the model.
//   @url:     - The url of the json file with the model specification.
//
// Returns:
//   { shader, uniforms, mesh } or null if an error was encountered.
export async function LoadPrefab(
	gl: GL,
	shader: Shader,
	url: string,
): Promise<Prefab | null> {
	const response = await fetch(`${url}/index.json`);
	if (!response.ok) {
		ShowError(`Error requesting ${url}: ${response}`);
		return null;
	}
	const json = await response.json();
	const mesh = CreateStaticBuffer(gl, shader, {
		vertices: new Float32Array(json.vertices),
		indexArray: new Uint16Array(json.indices),
		attributes: json.attributes,
	});
	if (!mesh) {
		ShowError(`Failed to create mesh for url ${url}`);
		return null;
	}

	const uniforms: Record<string, Uniform> = {};
	for (let i = 0; i < json.uniforms.length; i++) {
		const uniform = await LoadUniform(gl, json.uniforms[i], url);
		if (uniform) {
			uniforms[json.uniforms[i].label] = uniform;
		}
	}

	return {
		shader,
		uniforms,
		mesh,
	};
}

// Draws the provided mesh to the screen.
//
// Args:
//   @mesh:
//     @vao            -    VAO for the mesh.
//     @vio            -    Index Array object for the mesh.
//     @vbo            -    Virtex Buffer object for the mesh.
//     @verticesCount - The number of triangles in the mesh.
export function DrawMesh(gl: GL, mesh: Buffer) {
	// TODO: Add the number of triangles to the Mesh
	// @ts-ignore
	gl.bindVertexArray(mesh.vao);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.vio);
	gl.drawElements(gl.TRIANGLES, mesh.verticesCount, gl.UNSIGNED_SHORT, 0);
}

// Clears the canvas, preparing it for the next frame.
export function ClearCanvas(glContext: GLContext) {
	glContext.gl.clearColor(0.08, 0.08, 0.08, 1.0);
	glContext.gl.clear(
		glContext.gl.COLOR_BUFFER_BIT | glContext.gl.DEPTH_BUFFER_BIT,
	);
	glContext.gl.clearDepth(1.0); // Clear everything
	glContext.gl.enable(glContext.gl.DEPTH_TEST); // Enable depth testing
	glContext.gl.depthFunc(glContext.gl.LEQUAL); // Near things obscure far things

	// Rasterizer (which output pixels are covered by a triangle?)
	glContext.gl.viewport(0, 0, glContext.width, glContext.height);
}

export interface GLContext {
	gl: GL;
	canvas: HTMLCanvasElement;
	width: number;
	height: number;
	textureSlots: LRUCache<Uniform, number>;
	prefabs: LRUCache<{ shader: Shader; url: string }, Promise<Prefab | null>>;
}

// Create and return the WebGL render context for the canvas.
//
// If an error is encountered, null is returned.
export function GetGlContext(): GLContext | null {
	/** @type {HTMLCanvasElement|null} */
	const canvas = document.getElementById("demo-canvas") as HTMLCanvasElement;
	if (!canvas) {
		ShowError(
			"Could not find HTML canvas element - check for typos, or loading JavaScript file too early",
		);
		return null;
	}
	const gl = canvas.getContext("webgl2");
	if (!gl) {
		const isWebGl1Supported = !!document
			.createElement("canvas")
			.getContext("webgl");
		if (isWebGl1Supported) {
			ShowError(
				"WebGL 1 is supported, but not v2 - try using a different device or browser",
			);
		} else {
			ShowError(
				"WebGL is not supported on this device - try using a different device or browser",
			);
		}
		return null;
	}

	return {
		gl,
		canvas,
		width: canvas.clientWidth,
		height: canvas.clientHeight,
		textureSlots: NewTextureSlotCache(gl),
		prefabs: NewPrefabCache(gl),
	};
}

export interface ShaderSpec {
	vertexShader: string;
	fragmentShader: string;
}

export interface Shader {
	id: any;
	use(): void;
}

// Compile and loads a Shader program into memory.
//
// Args:
//   @gl               - The glContext giving access to WebGL APIs.
//   @shader
//     @vertexShader   - Source code for the Vertex Shader program.
//     @fragmentShader - Source code for the Fragment Shader program.
//
// Returns the created Shader Program. If an error is encountered, returns null.
export function CreateShaderProgram(gl: GL, shader: ShaderSpec): Shader | null {
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	if (!vertexShader) {
		ShowError("Failed to create vertex shader");
		return null;
	}
	gl.shaderSource(vertexShader, shader.vertexShader);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		const errorMessage = gl.getShaderInfoLog(vertexShader);
		ShowError(`Failed to compile vertex shader: ${errorMessage}`);
		return null;
	}

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	if (!fragmentShader) {
		ShowError("Failed to create fragment shader");
		return null;
	}
	gl.shaderSource(fragmentShader, shader.fragmentShader);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		const errorMessage = gl.getShaderInfoLog(fragmentShader);
		ShowError(`Failed to compile fragment shader: ${errorMessage}`);
		return null;
	}

	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const errorMessage = gl.getProgramInfoLog(program);
		ShowError(`Failed to link GPU program: ${errorMessage}`);
		return null;
	}

	return {
		id: program,
		use() {
			gl.useProgram(program);
		},
	};
}

export interface BufferSpec {
	vertices: Float32Array;
	indexArray: Uint16Array;
	attributes: { name: string; size: number }[];
}

export interface Buffer {
	vao: any;
	vbo: any;
	vio: any;
	verticesCount: number;
}

// Given a glContext and a static Float32Array, loads the Float32Array onto the GPU.
//
// Args:
//   @gl              - The glContext giving access to WebGL APIs.
//   @shader:         - The ShaderProgram to use when drawing the geometry.
//   @buffer:
//     @vertices      - The Float32Array of vertex data.
//     @indexArray    - Index array for Triangles to render.
//     @attributes[]  - List of the following:
//       @name        - Attribute name.
//       @size        - Size of the offset (in number of floats)
//
// Returns {vao, shader} or null if an error was encountered.
export function CreateStaticBuffer(
	gl: GL,
	shader: Shader,
	buffer: BufferSpec,
): Buffer | null {
	// Create VAO.
	// @ts-ignore
	const vao = gl.createVertexArray();
	if (!vao) {
		ShowError("Failed to create VAO");
		return null;
	}
	// @ts-ignore
	gl.bindVertexArray(vao);

	const vbo = gl.createBuffer();
	if (!vbo) {
		ShowError("Failed to allocate array buffer");
		return null;
	}

	// Bind vertex buffer data.
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, buffer.vertices, gl.STATIC_DRAW);

	let stride = 0;
	for (let i = 0; i < buffer.attributes.length; i++) {
		stride += buffer.attributes[i].size;
	}

	// Attributes
	let offset = 0;
	for (let i = 0; i < buffer.attributes.length; i++) {
		const attributeId = gl.getAttribLocation(
			shader.id,
			buffer.attributes[i].name,
		);
		gl.enableVertexAttribArray(attributeId);
		gl.vertexAttribPointer(
			attributeId,
			buffer.attributes[i].size,
			gl.FLOAT,
			false,
			stride * Float32Array.BYTES_PER_ELEMENT,
			offset * Float32Array.BYTES_PER_ELEMENT,
		);
		offset += buffer.attributes[i].size;
	}

	// Index buffer
	const vio = gl.createBuffer();
	if (!vio) {
		ShowError("Failed to allocate index buffer");
		return null;
	}
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vio);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buffer.indexArray, gl.STATIC_DRAW);

	// Unbind everything.
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	// @ts-ignore
	gl.bindVertexArray(null);

	return { vao, vbo, vio, verticesCount: buffer.indexArray.length };
}

export interface Texture {
	texture: WebGLTexture;
	id: string;
}

// Sends an image to the GPU as a texture, and returns the created texture id.
// Args:
//   @gl:     WebGL handle
//   @image:  The Image object to load onto the GPU.
//
// Returns:
//   A texture object representing the image loaded to the GPU.
export function CreateTexture(gl: GL, image: Image): Texture {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	// WebGL1 has different requirements for power of 2 images
	// vs. non power of 2 images so check if the image is a
	// power of 2 in both dimensions.
	function isPowerOf2(value: number): boolean {
		return (value & (value - 1)) === 0;
	}
	if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
		// Yes, it's a power of 2. Generate mips.
		gl.generateMipmap(gl.TEXTURE_2D);
	} else {
		// No, it's not a power of 2. Turn off mips and set
		// wrapping to clamp to edge
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}
	return { texture, id: image.src };
}

// Loads an image from url into the GPU.
// Args:
//   @gl:     WebGL handle
//   @url:  The url to download the image / texture from.
//
// Returns:
//   A texture object representing the image loaded to the GPU.
export async function CreateTextureFromUrl(
	gl: GL,
	url: string,
): Promise<Texture> {
	const loadImage: Promise<Image> = new Promise((res) => {
		const image = new Image();
		image.src = url;
		image.onload = () => res(image);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	});

	return CreateTexture(gl, await loadImage);
}

export enum UNIFORM_TYPES {
	INT = "INT",
	FLOAT = "FLOAT",
	VEC2 = "VEC2",
	VEC3 = "VEC3",
	VEC4 = "VEC4",
	MAT2 = "MAT2",
	MAT3 = "MAT3",
	MAT4 = "MAT4",
	TEX2D = "TEX2D",
}

export interface UniformSpec {
	label: string;
	value: any;
	typeHint: UNIFORM_TYPES;
}

export interface Uniform {
	label: string;
	value: any;
	typeHint: UNIFORM_TYPES;
	textureName?: string;
}

// Loads a uniform from a uniform object.
//
export async function LoadUniform(
	gl: GL,
	uniform: UniformSpec,
	url: string,
): Promise<Uniform | null> {
	switch (uniform.typeHint) {
		case UNIFORM_TYPES.INT:
		case UNIFORM_TYPES.FLOAT:
			return uniform;
		case UNIFORM_TYPES.VEC2:
			// @ts-ignore
			return { ...uniform, value: vec2.fromValues(...uniform.value) };
		case UNIFORM_TYPES.VEC3:
			// @ts-ignore
			return { ...uniform, value: vec3.fromValues(...uniform.value) };
		case UNIFORM_TYPES.VEC4:
			// @ts-ignore
			return { ...uniform, value: vec4.fromValues(...uniform.value) };
		case UNIFORM_TYPES.MAT2:
			// @ts-ignore
			return { ...uniform, value: mat2.fromValues(...uniform.value) };
		case UNIFORM_TYPES.MAT3:
			// @ts-ignore
			return { ...uniform, value: mat3.fromValues(...uniform.value) };
		case UNIFORM_TYPES.MAT4:
			// @ts-ignore
			return { ...uniform, value: mat4.fromValues(...uniform.value) };
		case UNIFORM_TYPES.TEX2D:
			const textureName = `${url}/${uniform.value}`;
			return {
				...uniform,
				value: await CreateTextureFromUrl(gl, textureName),
				textureName,
			};
		default:
			ShowError(`Unrecognized typeHint: ${uniform.typeHint}`);
			return null;
	}
}

// Sends a uniform to the GPU.
// Args:
//   @gl:      WebGL handle
//   @shader:  The shader object to set uniforms on.
//   @uniform: The uniform object to send to the GPU
//     @label: Name of the shader uniform.
//     @value: The value of the uniform. Should be a Primative or a Float32.
//     @typeHint: Identifies the type of the uniform.
export function BindUniform(
	glContext: GLContext,
	shader: Shader,
	uniform: Uniform,
) {
	const gl = glContext.gl;
	const uniformId = gl.getUniformLocation(shader.id, uniform.label);
	switch (uniform.typeHint) {
		case UNIFORM_TYPES.INT:
			gl.uniform1i(uniformId, uniform.value);
			return;
		case UNIFORM_TYPES.FLOAT:
			gl.uniform1f(uniformId, uniform.value);
			return;
		case UNIFORM_TYPES.VEC2:
			gl.uniform2fv(uniformId, uniform.value);
			return;
		case UNIFORM_TYPES.VEC3:
			gl.uniform3fv(uniformId, uniform.value);
			return;
		case UNIFORM_TYPES.VEC4:
			gl.uniform4fv(uniformId, uniform.value);
			return;
		case UNIFORM_TYPES.MAT2:
			gl.uniformMatrix2fv(uniformId, false, uniform.value);
			return;
		case UNIFORM_TYPES.MAT3:
			gl.uniformMatrix3fv(uniformId, false, uniform.value);
			return;
		case UNIFORM_TYPES.MAT4:
			gl.uniformMatrix4fv(uniformId, false, uniform.value);
			return;
		case UNIFORM_TYPES.TEX2D:
			// TODO: Allow for multiple textureSlots to be bound at once.
			const textureSlot = glContext.textureSlots.get(uniform.value);
			gl.activeTexture(textureSlot);
			gl.bindTexture(gl.TEXTURE_2D, uniform.value.texture);
			gl.uniform1i(uniformId, textureSlot - gl.TEXTURE0);
			return;
		default:
			console.warn(`Unrecognized typeHint: ${uniform.typeHint}`);
			return;
	}
}

// Draws a model to the GPU
//
// The shader must be bound before calling DrawPrefab.
//
// Args:
//   @gl:                - The gl context.
//   @model:             - The model object to load.
//     @shader:          - The shader id to draw to.
//     @uniforms:        - List of uniforms.
//       @name:          - The name of the uniform.
//       @value:         - The value of the uniform.
//       @typeHint:      - TypeHint of the uniform. Should be a UNIFORM_TYPE
//     @mesh:            - The mesh object to draw.
//     @vao            -    VAO for the mesh.
//     @vio            -    Index Array object for the mesh.
//     @vbo            -    Virtex Buffer object for the mesh.
//     @verticesCount  - The number of triangles in the mesh.
export function DrawPrefab(glContext: GLContext, prefab: Prefab): void {
	for (const label in prefab.uniforms) {
		BindUniform(glContext, prefab.shader, prefab.uniforms[label]);
	}
	DrawMesh(glContext.gl, prefab.mesh);
}
