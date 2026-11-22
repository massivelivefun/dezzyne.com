import type { KeypadShaderModule } from "./keypad.ts";
import type {
    LabelManager,
    LabelSlot,
    PortalsShaderModule,
} from "./portals.ts";
import {
    BOUNDED_QUAD_VERTEX_SHADER,
    CAMERA_FLOATS,
    FULLSCREEN_TRIANGLE_VERTEX_SHADER,
    GLSL_CAMERA_RAY_LIB,
    GLSL_PORTAL_RINGS_LIB,
    KEYPAD_FLOATS,
    MAJOR_GRID_STEP,
    MAXIMUM_PORTALS,
    METADATA_U32S_PER_PORTAL,
    PARTICLE_FLOATS,
    PORTAL_FLOATS,
    RING_FLOATS_PER_PORTAL,
    asCssPixels,
    asDevicePixelRatio,
    asDevicePixels,
    asElementCount,
    asGlslSource,
    asMilliseconds,
    asRadians,
    asSeconds,
    clampSignedUnit,
    clampUnitInterval,
    createSkySeedVector,
    generateRandomSeed,
    populateSkySeedVector,
    type Branded,
    type CameraUniformBuffer,
    type CssPixels,
    type CustomSkyboxId,
    type DarkSkyboxId,
    type DevicePixelRatio,
    type DevicePixels,
    type ElementCount,
    type GlslSource,
    type KeypadUniformBuffer,
    type LightSkyboxId,
    type Milliseconds,
    type ParticlesInstanceBuffer,
    type PortalMetadataBuffer,
    type PortalRingsBuffer,
    type PortalsUniformBuffer,
    type QuadBoundsTuple,
    type QualityTier,
    type Radians,
    type RandomSeed,
    type SafeRelativeHref,
    type Seconds,
    type SignedUnit,
    type SkySeedVector,
    type SkyboxGeneration,
    type SkyboxId,
    type SkyboxShaderModule,
    type ThemeSkyboxId,
    type UnitInterval,
    type WasmBooleanFlag,
    type WasmByteOffset,
} from "./shader-lib.ts";

const {
    ArrayBuffer,
    Float32Array,
    Math,
    Number,
    Object,
    Uint8Array,
    Uint32Array,
    URL,
    WebAssembly,
} = globalThis;

type ByteCount = Branded<number, "ByteCount">;
type PointerIdentifier = Branded<number, "PointerIdentifier">;
type AnimationFrameHandle = Branded<number, "AnimationFrameHandle">;
type HitEntityResult = number;

function asByteCount(rawBytes: number): ByteCount {
    return rawBytes as ByteCount;
}

function asPointerIdentifier(rawId: number): PointerIdentifier {
    return rawId as PointerIdentifier;
}

function asAnimationFrameHandle(rawHandle: number): AnimationFrameHandle {
    return rawHandle as AnimationFrameHandle;
}

function asSkyboxGeneration(rawGeneration: number): SkyboxGeneration {
    return rawGeneration as SkyboxGeneration;
}

const WASM_MODULE_URL: SafeRelativeHref =
    "/wasm/dezzyne_bg.wasm" as SafeRelativeHref;
const MAXIMUM_WASM_BYTES: ByteCount = asByteCount(65536);
const MINIMUM_WASM_BYTES: ByteCount = asByteCount(8);
const MAXIMUM_STAGE_DIMENSION: DevicePixels = asDevicePixels(8192);

const SCENE_GRID = 0 as const;
const SCENE_PORTALS = 1 as const;
const SCENE_KEYPAD = 2 as const;

type SceneMode =
    | typeof SCENE_GRID
    | typeof SCENE_PORTALS
    | typeof SCENE_KEYPAD;

type ScreenPointTuple = readonly [CssPixels, CssPixels];
type NormalizedCameraTuple = readonly [SignedUnit, SignedUnit];
type TouchInputTuple = readonly [CssPixels, CssPixels, CssPixels, CssPixels];

interface WasmStageExports {
    readonly memory: WebAssembly.Memory;
    initialize_scene(
        width: CssPixels,
        height: CssPixels,
        sceneMode: SceneMode,
        randomSeed: RandomSeed
    ): void;
    resize_scene(width: CssPixels, height: CssPixels): void;
    pointer_move(pointerX: CssPixels, pointerY: CssPixels): void;
    touch_move(
        cameraX: CssPixels,
        cameraY: CssPixels,
        lightX: CssPixels,
        lightY: CssPixels
    ): void;
    pointer_leave(): void;
    click_stage(pointerX: CssPixels, pointerY: CssPixels): HitEntityResult;
    is_interactive_hovered(): WasmBooleanFlag;
    step_scene(
        deltaSeconds: Seconds,
        motionScale: number,
        entitiesReady: WasmBooleanFlag
    ): QualityTier;
    get_camera_pointer(): WasmByteOffset;
    get_keypad_pointer(): WasmByteOffset;
    get_portal_count(): ElementCount;
    get_portals_pointer(): WasmByteOffset;
    get_rings_pointer(): WasmByteOffset;
    get_particles_pointer(): WasmByteOffset;
    get_particle_count(): ElementCount;
    get_portal_metadata_pointer(): WasmByteOffset;
}

interface ParallelShaderCompileExtension {
    readonly COMPLETION_STATUS_KHR: GLenum;
}

interface AsynchronousProgramJob {
    poll(): boolean;
    dispose(): void;
}

interface GridUniformLocations {
    readonly resolution: WebGLUniformLocation | null;
    readonly devicePixelRatio: WebGLUniformLocation | null;
    readonly camera: WebGLUniformLocation | null;
    readonly skyboxMix: WebGLUniformLocation | null;
    readonly portalCount: WebGLUniformLocation | null;
    readonly portals: WebGLUniformLocation | null;
    readonly rings: WebGLUniformLocation | null;
    readonly keypadFloor: WebGLUniformLocation | null;
}

interface SkyboxUniformLocations {
    readonly resolution: WebGLUniformLocation | null;
    readonly devicePixelRatio: WebGLUniformLocation | null;
    readonly camera: WebGLUniformLocation | null;
    readonly time: WebGLUniformLocation | null;
    readonly skySeed: WebGLUniformLocation | null;
}

interface KeypadUniformLocations {
    readonly resolution: WebGLUniformLocation | null;
    readonly devicePixelRatio: WebGLUniformLocation | null;
    readonly zero: WebGLUniformLocation | null;
    readonly boundsRect: WebGLUniformLocation | null;
    readonly camera: WebGLUniformLocation | null;
    readonly keypad: WebGLUniformLocation | null;
}

interface PortalUniformLocations {
    readonly resolution: WebGLUniformLocation | null;
    readonly devicePixelRatio: WebGLUniformLocation | null;
    readonly zero: WebGLUniformLocation | null;
    readonly boundsRect: WebGLUniformLocation | null;
    readonly camera: WebGLUniformLocation | null;
    readonly portal: WebGLUniformLocation | null;
    readonly rings: WebGLUniformLocation | null;
    readonly phaseOffset: WebGLUniformLocation | null;
}

interface LabelUniformLocations {
    readonly resolution: WebGLUniformLocation | null;
    readonly boundsRect: WebGLUniformLocation | null;
    readonly texture: WebGLUniformLocation | null;
    readonly alpha: WebGLUniformLocation | null;
}

interface PortalFrameViews {
    readonly portalsView: PortalsUniformBuffer | null;
    readonly ringsView: PortalRingsBuffer | null;
    readonly particlesView: ParticlesInstanceBuffer | null;
}

type KeypadQuadProjector = (
    viewportWidth: CssPixels,
    viewportHeight: CssPixels,
    cameraBuffer: CameraUniformBuffer,
    keypadBuffer: KeypadUniformBuffer
) => QuadBoundsTuple;

interface StageRenderer {
    areEntitiesReady(): boolean;
    setLightMode(nextLightMode: boolean): void;
    setSkyboxAllowed(allowed: boolean): void;
    stepSkybox(scaledDeltaSeconds: Seconds): void;
    beginSkyboxTransition(): SkyboxGeneration;
    attachSkyboxModule(
        skyboxModule: SkyboxShaderModule,
        requestGeneration: SkyboxGeneration
    ): void;
    attachKeypadModule(keypadModule: KeypadShaderModule): void;
    attachPortalsModule(portalsModule: PortalsShaderModule): void;
    pollAsynchronousJobs(): boolean;
    synchronizeLabels(
        portalCount: ElementCount,
        metadataView: PortalMetadataBuffer
    ): void;
    render(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        devicePixelRatio: DevicePixelRatio,
        cameraBuffer: CameraUniformBuffer,
        keypadBuffer: KeypadUniformBuffer | null,
        portalCount: ElementCount,
        portalsBuffer: PortalsUniformBuffer | null,
        ringsBuffer: PortalRingsBuffer | null,
        particleCount: ElementCount,
        particlesBuffer: ParticlesInstanceBuffer | null
    ): boolean;
    dispose(): void;
}

const DARK_SKYBOX_IDS: readonly DarkSkyboxId[] = Object.freeze([
    "dark-nebula",
    "dark-aurora",
    "dark-twilight",
]);

const LIGHT_SKYBOX_IDS: readonly LightSkyboxId[] = Object.freeze([
    "light-cirrus",
    "light-dawn",
    "light-mist",
]);

const WASM_FETCH_OPTIONS: RequestInit = Object.freeze({
    method: "GET",
    credentials: "same-origin",
    mode: "cors",
});

const WEBGL_CONTEXT_OPTIONS: WebGLContextAttributes = Object.freeze({
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
});

const REQUIRED_FUNCTION_EXPORTS: readonly (keyof WasmStageExports)[] =
    Object.freeze([
        "initialize_scene",
        "resize_scene",
        "pointer_move",
        "touch_move",
        "pointer_leave",
        "click_stage",
        "is_interactive_hovered",
        "step_scene",
        "get_camera_pointer",
        "get_keypad_pointer",
        "get_portal_count",
        "get_portals_pointer",
        "get_rings_pointer",
        "get_particles_pointer",
        "get_particle_count",
        "get_portal_metadata_pointer",
    ]);

function hasValidWasmHeader(byteBuffer: unknown): byteBuffer is ArrayBuffer {
    if (!(byteBuffer instanceof ArrayBuffer)) {
        return false;
    }
    const byteLength: ByteCount = asByteCount(byteBuffer.byteLength);
    if (byteLength < MINIMUM_WASM_BYTES || byteLength > MAXIMUM_WASM_BYTES) {
        return false;
    }
    const headerBytes: Uint8Array = new Uint8Array(byteBuffer, 0, 8);
    return (
        headerBytes[0] === 0x00 &&
        headerBytes[1] === 0x61 &&
        headerBytes[2] === 0x73 &&
        headerBytes[3] === 0x6d &&
        headerBytes[4] === 0x01 &&
        headerBytes[5] === 0x00 &&
        headerBytes[6] === 0x00 &&
        headerBytes[7] === 0x00
    );
}

function isValidContentLengthHeader(
    contentLengthHeader: string | null
): boolean {
    if (contentLengthHeader === null) {
        return true;
    }
    const declaredLength: number = Number(contentLengthHeader);
    return (
        Number.isFinite(declaredLength) &&
        declaredLength >= MINIMUM_WASM_BYTES &&
        declaredLength <= MAXIMUM_WASM_BYTES
    );
}

function isWasmStageExports(
    rawExports: WebAssembly.Exports | undefined
): rawExports is WebAssembly.Exports & WasmStageExports {
    if (!rawExports || !(rawExports.memory instanceof WebAssembly.Memory)) {
        return false;
    }
    for (
        let exportIndex: number = 0;
        exportIndex < REQUIRED_FUNCTION_EXPORTS.length;
        exportIndex++
    ) {
        const exportName: keyof WasmStageExports =
            REQUIRED_FUNCTION_EXPORTS[exportIndex];
        if (typeof rawExports[exportName] !== "function") {
            return false;
        }
    }
    return true;
}

function verifyWasmExports(
    wasmInstance: WebAssembly.Instance | null | undefined
): WasmStageExports | null {
    const rawExports: WebAssembly.Exports | undefined = wasmInstance?.exports;
    if (!isWasmStageExports(rawExports)) {
        return null;
    }
    return rawExports;
}

async function loadVerifiedWasm(): Promise<WasmStageExports | null> {
    if (typeof WebAssembly !== "object" || WebAssembly === null) {
        return null;
    }

    const response: Response = await fetch(
        WASM_MODULE_URL,
        WASM_FETCH_OPTIONS
    );
    const validResponseType: boolean =
        response.type === "basic" || response.type === "cors";
    if (
        !response.ok ||
        response.status !== 200 ||
        response.redirected ||
        !validResponseType
    ) {
        return null;
    }

    const responseUrl: URL = new URL(response.url, window.location.origin);
    if (responseUrl.origin !== window.location.origin) {
        return null;
    }
    if (responseUrl.pathname !== WASM_MODULE_URL) {
        return null;
    }

    const contentLengthHeader: string | null =
        response.headers.get("content-length");
    if (!isValidContentLengthHeader(contentLengthHeader)) {
        return null;
    }

    const rawContentType: string = response.headers.get("content-type") || "";
    const contentType: string = rawContentType.toLowerCase();
    const isWasmMime: boolean = contentType.startsWith("application/wasm");
    const isOctetMime: boolean = contentType.startsWith(
        "application/octet-stream"
    );
    if (contentType && !isWasmMime && !isOctetMime) {
        return null;
    }

    const emptyImports: WebAssembly.Imports = Object.create(null);
    if (isWasmMime && typeof WebAssembly.instantiateStreaming === "function") {
        const streamingResult: WebAssembly.WebAssemblyInstantiatedSource =
            await WebAssembly.instantiateStreaming(response, emptyImports);
        return verifyWasmExports(streamingResult.instance);
    }

    const wasmBytes: ArrayBuffer = await response.arrayBuffer();
    if (!hasValidWasmHeader(wasmBytes)) {
        return null;
    }
    const bufferResult: WebAssembly.WebAssemblyInstantiatedSource =
        await WebAssembly.instantiate(wasmBytes, emptyImports);
    return verifyWasmExports(bufferResult.instance);
}

const INITIAL_WASM_PROMISE: Promise<WasmStageExports | null> =
    loadVerifiedWasm().catch((): null => null);

function isSkyboxShaderModule(
    candidate: unknown
): candidate is SkyboxShaderModule {
    if (typeof candidate !== "object" || candidate === null) {
        return false;
    }
    const sourceValue: unknown = Reflect.get(
        candidate,
        "SKYBOX_FRAGMENT_SHADER_SOURCE"
    );
    return typeof sourceValue === "string";
}

function buildGridFragmentShader(sceneMode: SceneMode): GlslSource {
    const hasPortals: boolean = sceneMode === SCENE_PORTALS;
    const hasKeypad: boolean = sceneMode === SCENE_KEYPAD;

    const portalDeclarations: string = hasPortals
        ? `uniform int u_portal_count;
uniform vec4 u_portals[12];
uniform vec4 u_rings[8];
${GLSL_PORTAL_RINGS_LIB}`
        : "";

    const keypadDeclaration: string = hasKeypad
        ? "uniform vec4 u_keypad_floor;\n"
        : "";

    const portalLightingBody: string = hasPortals
        ? `    float ringDenominator = min(rayDirection.y, -0.006);
    float ringVisibility = smoothstep(-0.008, -0.028, rayDirection.y);
    vec3 portalFloorAmbient = vec3(0.04, 0.13, 0.28);
    vec3 portalLineGlow = vec3(0.16, 0.54, 1.00);
    vec3 portalRingColor = vec3(0.18, 0.60, 1.00);
    for (int portalIndex = 0; portalIndex < u_portal_count; portalIndex++) {
        vec4 portalWorld = u_portals[portalIndex * 3 + 1];
        vec4 portalState = u_portals[portalIndex * 3 + 2];
        if (portalWorld.z <= 0.5) {
            continue;
        }
        float portalScale = max(portalState.z, 0.1);
        float floorDistance =
            length(floorWorldXz - portalWorld.xy) / portalScale;
        float floorGlow =
            exp(-floorDistance * floorDistance * 0.52)
            * portalState.y
            * floorMask;
        darkEmissive += portalFloorAmbient * floorGlow;
        darkEmissive += portalLineGlow
            * max(minorLine, majorLine)
            * floorGlow
            * 0.55;

        float ringIntersectionDistance =
            (portalWorld.w - cameraPosition.y) / ringDenominator;
        vec2 ringPlaneXz =
            cameraPosition.xz + rayDirection.xz * ringIntersectionDistance;
        float ringRadialDistance =
            length(ringPlaneXz - portalWorld.xy) / portalScale;
        vec4 ringPair0 = u_rings[portalIndex * 2];
        vec4 ringPair1 = u_rings[portalIndex * 2 + 1];
        vec4 ringRadii = vec4(ringPair0.xz, ringPair1.xz) / portalScale;
        vec4 rawAlphas = vec4(ringPair0.yw, ringPair1.yw);
        vec4 ringAlphas = step(vec4(0.001), rawAlphas) * rawAlphas;
        float ringSum =
            evaluatePortalRings(ringRadialDistance, ringRadii, ringAlphas);
        darkEmissive += portalRingColor
            * min(ringSum, 2.2)
            * ringVisibility
            * 0.92;
    }
`
        : "";

    const keypadLightingBody: string = hasKeypad
        ? `    if (u_keypad_floor.z > 0.001) {
        vec2 floorOffset = floorWorldXz - u_keypad_floor.xy;
        float floorDistance = length(floorOffset);
        float lightPool = exp(-floorDistance * floorDistance * 0.42)
            * floorMask
            * u_keypad_floor.z;
        float tintGradient = clamp(floorOffset.x * 0.42 + 0.5, 0.0, 1.0);
        vec3 keypadMintTint = vec3(0.24, 0.88, 0.72);
        vec3 keypadVioletTint = vec3(0.72, 0.40, 0.96);
        vec3 floorTint = mix(keypadMintTint, keypadVioletTint, tintGradient);
        float hoverBoost = 1.0 + u_keypad_floor.w * 0.28;
        darkEmissive += floorTint * lightPool * 0.09 * hoverBoost;
        darkEmissive += floorTint
            * max(minorLine, majorLine)
            * lightPool
            * 0.36
            * hoverBoost;
    }
`
        : "";

    const sourceText: string = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform vec4 u_camera[5];
uniform float u_skybox_mix;
${portalDeclarations}${keypadDeclaration}
out vec4 outColor;
${GLSL_CAMERA_RAY_LIB}
vec2 evaluateGridAxis(
    vec2 gridCoord,
    vec2 derivativeWidth,
    float radiusPixels
) {
    vec2 lineCoverage = clamp(1.0 - derivativeWidth * 1.15, 0.0, 1.0);
    vec2 distancePixels =
        abs(fract(gridCoord - 0.5) - 0.5) / max(derivativeWidth, vec2(1e-4));
    vec2 smoothEdge =
        smoothstep(radiusPixels - 0.55, radiusPixels + 0.55, distancePixels);
    return (1.0 - smoothEdge) * lineCoverage;
}

void main() {
    vec2 pixelPosition =
        computeStagePixelPosition(u_resolution, u_device_pixel_ratio);
    vec3 cameraPosition = u_camera[0].xyz;
    vec3 rayDirection =
        computeStageRayDirection(pixelPosition, u_resolution, u_camera);
    float scrollOffsetZ = u_camera[1].w;

    vec2 centeredUv = (pixelPosition / u_resolution) - 0.5;
    float vignette = dot(centeredUv, centeredUv);
    float horizonGlow = exp(-abs(rayDirection.y) * 16.0);

    float floorDenominator = min(rayDirection.y, -0.012);
    float floorIntersectionDistance =
        (u_camera[2].w - cameraPosition.y) / floorDenominator;
    vec2 floorWorldXz =
        cameraPosition.xz + rayDirection.xz * floorIntersectionDistance;
    vec2 scrolledFloorXz = floorWorldXz + vec2(0.0, scrollOffsetZ);
    vec2 floorDerivative = fwidth(scrolledFloorXz);

    float floorMask = smoothstep(-0.014, -0.055, rayDirection.y);
    float minorVisibility =
        floorMask * exp(-floorIntersectionDistance * 0.095);
    float majorVisibility =
        floorMask * exp(-floorIntersectionDistance * 0.055);
    float nearFloorShadow = floorMask * exp(-floorIntersectionDistance * 0.14);

    vec3 darkFloorBase = vec3(0.1686);
    vec3 darkHorizonLift = vec3(0.022, 0.023, 0.025);
    vec3 darkNearShade = vec3(0.015);
    vec3 darkSurface = darkFloorBase
        - vignette * 0.032
        + darkHorizonLift * horizonGlow
        - darkNearShade * nearFloorShadow;

    vec2 minorAxes = evaluateGridAxis(scrolledFloorXz, floorDerivative, 0.45);
    vec2 majorAxes = evaluateGridAxis(
        scrolledFloorXz * 0.25,
        floorDerivative * 0.25,
        0.72
    );
    float minorLine = max(minorAxes.x, minorAxes.y);
    float majorLine = max(majorAxes.x, majorAxes.y);
    float majorIntersection = majorAxes.x * majorAxes.y;

    float cursorDistance = length(floorWorldXz - u_camera[4].xy);
    float spotlightFalloff = exp(-cursorDistance * cursorDistance * 0.11);
    float cursorSpotlight = spotlightFalloff * u_camera[4].w * floorMask;

    float darkGridLuminance = minorLine * 0.055 * minorVisibility
        + majorLine * 0.135 * majorVisibility
        + majorIntersection * 0.075 * majorVisibility
        + max(minorLine, majorLine) * 0.19 * cursorSpotlight
        + 0.020 * cursorSpotlight;
    vec3 darkEmissive = vec3(darkGridLuminance);

${portalLightingBody}${keypadLightingBody}
    float skyFloorAlpha =
        floorMask * 0.92 * exp(-floorIntersectionDistance * 0.038);
    float darkAlpha = mix(1.0, skyFloorAlpha, u_skybox_mix);
    vec3 darkPremultiplied = darkSurface * darkAlpha + darkEmissive;

    outColor = vec4(darkPremultiplied, darkAlpha);
}
`;
    return asGlslSource(sourceText);
}

function readTypedFloat32Buffer<BufferBrand extends Float32Array>(
    wasmMemory: WebAssembly.Memory,
    byteOffset: WasmByteOffset,
    elementCount: ElementCount
): BufferBrand | null {
    if (elementCount === 0) {
        return new Float32Array(0) as BufferBrand;
    }
    if (
        !Number.isInteger(byteOffset) ||
        byteOffset < 0 ||
        (byteOffset & 3) !== 0
    ) {
        return null;
    }
    const memoryBuffer: ArrayBuffer = wasmMemory.buffer;
    const byteLength: ByteCount = asByteCount(elementCount * 4);
    if (byteOffset + byteLength > memoryBuffer.byteLength) {
        return null;
    }
    return new Float32Array(
        memoryBuffer,
        byteOffset,
        elementCount
    ) as BufferBrand;
}

function readPortalMetadataBuffer(
    wasmMemory: WebAssembly.Memory,
    byteOffset: WasmByteOffset,
    elementCount: ElementCount
): PortalMetadataBuffer | null {
    if (elementCount === 0) {
        return new Uint32Array(0) as PortalMetadataBuffer;
    }
    if (
        !Number.isInteger(byteOffset) ||
        byteOffset < 0 ||
        (byteOffset & 3) !== 0
    ) {
        return null;
    }
    const memoryBuffer: ArrayBuffer = wasmMemory.buffer;
    const byteLength: ByteCount = asByteCount(elementCount * 4);
    if (byteOffset + byteLength > memoryBuffer.byteLength) {
        return null;
    }
    return new Uint32Array(
        memoryBuffer,
        byteOffset,
        elementCount
    ) as PortalMetadataBuffer;
}

function deleteShaderIfPresent(
    glContext: WebGL2RenderingContext,
    shader: WebGLShader | null
): void {
    if (!shader) {
        return;
    }
    glContext.deleteShader(shader);
}

function compileShaderSynchronously(
    glContext: WebGL2RenderingContext,
    shaderType: GLenum,
    shaderSource: GlslSource
): WebGLShader | null {
    const shader: WebGLShader | null = glContext.createShader(shaderType);
    if (!shader) {
        return null;
    }
    glContext.shaderSource(shader, shaderSource);
    glContext.compileShader(shader);
    const compiled: unknown = glContext.getShaderParameter(
        shader,
        glContext.COMPILE_STATUS
    );
    if (!compiled) {
        glContext.deleteShader(shader);
        return null;
    }
    return shader;
}

function buildProgramSynchronously(
    glContext: WebGL2RenderingContext,
    vertexShaderSource: GlslSource,
    fragmentShaderSource: GlslSource
): WebGLProgram | null {
    const vertexShader: WebGLShader | null = compileShaderSynchronously(
        glContext,
        glContext.VERTEX_SHADER,
        vertexShaderSource
    );
    const fragmentShader: WebGLShader | null = compileShaderSynchronously(
        glContext,
        glContext.FRAGMENT_SHADER,
        fragmentShaderSource
    );
    if (!vertexShader || !fragmentShader) {
        deleteShaderIfPresent(glContext, vertexShader);
        deleteShaderIfPresent(glContext, fragmentShader);
        return null;
    }
    const shaderProgram: WebGLProgram | null = glContext.createProgram();
    if (!shaderProgram) {
        glContext.deleteShader(vertexShader);
        glContext.deleteShader(fragmentShader);
        return null;
    }
    glContext.attachShader(shaderProgram, vertexShader);
    glContext.attachShader(shaderProgram, fragmentShader);
    glContext.linkProgram(shaderProgram);
    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);
    const linked: unknown = glContext.getProgramParameter(
        shaderProgram,
        glContext.LINK_STATUS
    );
    if (!linked) {
        glContext.deleteProgram(shaderProgram);
        return null;
    }
    return shaderProgram;
}

function isProgramCompileCompleted(
    glContext: WebGL2RenderingContext,
    parallelCompileExtension: ParallelShaderCompileExtension | null,
    shaderProgram: WebGLProgram
): boolean {
    if (!parallelCompileExtension) {
        return true;
    }
    const statusValue: unknown = glContext.getProgramParameter(
        shaderProgram,
        parallelCompileExtension.COMPLETION_STATUS_KHR
    );
    return Boolean(statusValue);
}

function startAsynchronousProgram(
    glContext: WebGL2RenderingContext,
    parallelCompileExtension: ParallelShaderCompileExtension | null,
    vertexShaderSource: GlslSource,
    fragmentShaderSource: GlslSource,
    onProgramLinked: (shaderProgram: WebGLProgram) => void
): AsynchronousProgramJob {
    const vertexShader: WebGLShader | null = glContext.createShader(
        glContext.VERTEX_SHADER
    );
    const fragmentShader: WebGLShader | null = glContext.createShader(
        glContext.FRAGMENT_SHADER
    );
    const shaderProgram: WebGLProgram | null = glContext.createProgram();
    if (!vertexShader || !fragmentShader || !shaderProgram) {
        return {
            poll(): boolean {
                return false;
            },
            dispose(): void {},
        };
    }

    glContext.shaderSource(vertexShader, vertexShaderSource);
    glContext.compileShader(vertexShader);
    glContext.shaderSource(fragmentShader, fragmentShaderSource);
    glContext.compileShader(fragmentShader);
    glContext.attachShader(shaderProgram, vertexShader);
    glContext.attachShader(shaderProgram, fragmentShader);
    glContext.linkProgram(shaderProgram);

    let isCompleted: boolean = false;

    return {
        poll(): boolean {
            if (isCompleted) {
                return false;
            }
            const ready: boolean = isProgramCompileCompleted(
                glContext,
                parallelCompileExtension,
                shaderProgram
            );
            if (!ready) {
                return false;
            }

            isCompleted = true;
            glContext.deleteShader(vertexShader);
            glContext.deleteShader(fragmentShader);
            const isLinked: unknown = glContext.getProgramParameter(
                shaderProgram,
                glContext.LINK_STATUS
            );
            if (!isLinked) {
                glContext.deleteProgram(shaderProgram);
                return false;
            }
            onProgramLinked(shaderProgram);
            return true;
        },
        dispose(): void {
            if (!isCompleted) {
                isCompleted = true;
                glContext.deleteShader(vertexShader);
                glContext.deleteShader(fragmentShader);
            }
            glContext.deleteProgram(shaderProgram);
        },
    };
}

function applyFallbackWideFraming(
    cameraBuffer: CameraUniformBuffer,
    viewportWidth: CssPixels,
    viewportHeight: CssPixels
): void {
    const safeWidth: number = Math.max(1, viewportWidth);
    const safeHeight: number = Math.max(1, viewportHeight);
    const aspectRatio: number = safeWidth / safeHeight;
    const aspectWideness: UnitInterval = clampUnitInterval(
        (aspectRatio - 2.35) / 1.45
    );
    const shortHeightFactor: UnitInterval = clampUnitInterval(
        (440 - safeHeight) / 180
    );
    const landscapeGate: UnitInterval = clampUnitInterval(
        (aspectRatio - 1.4) / 0.6
    );
    const wideFraming: UnitInterval = clampUnitInterval(
        Math.max(aspectWideness, shortHeightFactor * landscapeGate)
    );
    const initialPitch: Radians = asRadians(-0.14 + wideFraming * 0.042);
    const pitchSine: number = Math.sin(initialPitch);
    const pitchCosine: number = Math.cos(initialPitch);
    cameraBuffer[3] = 0.58 - wideFraming * 0.2;
    cameraBuffer[5] = pitchSine;
    cameraBuffer[6] = pitchCosine;
    cameraBuffer[13] = pitchCosine;
    cameraBuffer[14] = -pitchSine;
}

function createInitialCameraBuffer(): CameraUniformBuffer {
    const rawBuffer: Float32Array = new Float32Array(CAMERA_FLOATS);
    const cameraBuffer: CameraUniformBuffer = rawBuffer as CameraUniformBuffer;
    cameraBuffer[8] = 1.0;
    cameraBuffer[11] = -1.55;
    cameraBuffer[17] = 8.0;
    cameraBuffer[18] = -1.0;
    applyFallbackWideFraming(
        cameraBuffer,
        asCssPixels(1280),
        asCssPixels(720)
    );
    return cameraBuffer;
}

function queryParallelCompileExtension(
    glContext: WebGL2RenderingContext
): ParallelShaderCompileExtension | null {
    const rawExtension: unknown = glContext.getExtension(
        "KHR_parallel_shader_compile"
    );
    if (typeof rawExtension !== "object" || rawExtension === null) {
        return null;
    }
    const statusEnum: unknown = Reflect.get(
        rawExtension,
        "COMPLETION_STATUS_KHR"
    );
    if (typeof statusEnum !== "number") {
        return null;
    }
    return { COMPLETION_STATUS_KHR: statusEnum };
}

function createStageRenderer(
    stage: HTMLCanvasElement,
    sceneMode: SceneMode,
    initialLightMode: boolean
): StageRenderer | null {
    const maybeGlContext: WebGL2RenderingContext | null = stage.getContext(
        "webgl2",
        WEBGL_CONTEXT_OPTIONS
    );
    if (!maybeGlContext) {
        return null;
    }
    const glContext: WebGL2RenderingContext = maybeGlContext;

    const parallelCompileExtension: ParallelShaderCompileExtension | null =
        queryParallelCompileExtension(glContext);
    const gridFragmentSource: GlslSource = buildGridFragmentShader(sceneMode);
    const maybeGridProgram: WebGLProgram | null = buildProgramSynchronously(
        glContext,
        FULLSCREEN_TRIANGLE_VERTEX_SHADER,
        gridFragmentSource
    );
    if (!maybeGridProgram) {
        return null;
    }
    const gridProgram: WebGLProgram = maybeGridProgram;

    const maybeGridVao: WebGLVertexArrayObject | null =
        glContext.createVertexArray();
    const maybeTriangleBuffer: WebGLBuffer | null = glContext.createBuffer();
    const maybeQuadBuffer: WebGLBuffer | null = glContext.createBuffer();
    if (!maybeGridVao || !maybeTriangleBuffer || !maybeQuadBuffer) {
        return null;
    }
    const gridVertexArray: WebGLVertexArrayObject = maybeGridVao;
    const triangleBuffer: WebGLBuffer = maybeTriangleBuffer;
    const quadBuffer: WebGLBuffer = maybeQuadBuffer;

    const triangleVertices: Float32Array = new Float32Array([
        -1, -1, 3, -1, -1, 3,
    ]);
    glContext.bindVertexArray(gridVertexArray);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, triangleBuffer);
    glContext.bufferData(
        glContext.ARRAY_BUFFER,
        triangleVertices,
        glContext.STATIC_DRAW
    );
    const gridPositionLocation: GLint = glContext.getAttribLocation(
        gridProgram,
        "a_position"
    );
    if (gridPositionLocation < 0) {
        return null;
    }
    glContext.enableVertexAttribArray(gridPositionLocation);
    glContext.vertexAttribPointer(
        gridPositionLocation,
        2,
        glContext.FLOAT,
        false,
        0,
        0
    );

    const quadVertices: Float32Array = new Float32Array([
        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
    glContext.bufferData(
        glContext.ARRAY_BUFFER,
        quadVertices,
        glContext.STATIC_DRAW
    );

    const gridUniforms: GridUniformLocations = {
        resolution: glContext.getUniformLocation(gridProgram, "u_resolution"),
        devicePixelRatio: glContext.getUniformLocation(
            gridProgram,
            "u_device_pixel_ratio"
        ),
        camera: glContext.getUniformLocation(gridProgram, "u_camera[0]"),
        skyboxMix: glContext.getUniformLocation(gridProgram, "u_skybox_mix"),
        portalCount: glContext.getUniformLocation(
            gridProgram,
            "u_portal_count"
        ),
        portals: glContext.getUniformLocation(gridProgram, "u_portals[0]"),
        rings: glContext.getUniformLocation(gridProgram, "u_rings[0]"),
        keypadFloor: glContext.getUniformLocation(
            gridProgram,
            "u_keypad_floor"
        ),
    };

    const paddedPortals: PortalsUniformBuffer = new Float32Array(
        MAXIMUM_PORTALS * PORTAL_FLOATS
    ) as PortalsUniformBuffer;
    const paddedRings: PortalRingsBuffer = new Float32Array(
        MAXIMUM_PORTALS * RING_FLOATS_PER_PORTAL
    ) as PortalRingsBuffer;
    const asynchronousJobs: AsynchronousProgramJob[] = [];

    let isLightModeActive: boolean = initialLightMode;
    let skyboxProgram: WebGLProgram | null = null;
    let skyboxVertexArray: WebGLVertexArrayObject | null = null;
    let skyboxUniforms: SkyboxUniformLocations | null = null;
    let skyboxTimeSeconds: Seconds = asSeconds(0.0);
    let skyboxBlend: UnitInterval = clampUnitInterval(0.0);
    let isSkyboxAllowed: boolean = true;
    let activeSkyboxGeneration: SkyboxGeneration = asSkyboxGeneration(0);
    const skySeedVector: SkySeedVector = createSkySeedVector();

    let keypadProgram: WebGLProgram | null = null;
    let keypadVertexArray: WebGLVertexArrayObject | null = null;
    let keypadUniforms: KeypadUniformLocations | null = null;
    let projectKeypadQuadFunction: KeypadQuadProjector | null = null;

    let portalProgram: WebGLProgram | null = null;
    let portalVertexArray: WebGLVertexArrayObject | null = null;
    let portalUniforms: PortalUniformLocations | null = null;

    let particleProgram: WebGLProgram | null = null;
    let particleVertexArray: WebGLVertexArrayObject | null = null;
    let instanceBuffer: WebGLBuffer | null = null;
    let instanceCapacity: ElementCount = asElementCount(0);
    let particleResolutionLocation: WebGLUniformLocation | null = null;

    let labelProgram: WebGLProgram | null = null;
    let labelVertexArray: WebGLVertexArrayObject | null = null;
    let labelUniforms: LabelUniformLocations | null = null;
    let labelManager: LabelManager | null = null;

    function bindFullscreenVertexArray(
        shaderProgram: WebGLProgram
    ): WebGLVertexArrayObject | null {
        const vertexArray: WebGLVertexArrayObject | null =
            glContext.createVertexArray();
        if (!vertexArray) {
            return null;
        }
        glContext.bindVertexArray(vertexArray);
        glContext.bindBuffer(glContext.ARRAY_BUFFER, triangleBuffer);
        const positionLocation: GLint = glContext.getAttribLocation(
            shaderProgram,
            "a_position"
        );
        if (positionLocation < 0) {
            glContext.deleteVertexArray(vertexArray);
            return null;
        }
        glContext.enableVertexAttribArray(positionLocation);
        glContext.vertexAttribPointer(
            positionLocation,
            2,
            glContext.FLOAT,
            false,
            0,
            0
        );
        return vertexArray;
    }

    function disposeActiveSkybox(): void {
        if (skyboxVertexArray) {
            glContext.deleteVertexArray(skyboxVertexArray);
            skyboxVertexArray = null;
        }
        if (skyboxProgram) {
            glContext.deleteProgram(skyboxProgram);
            skyboxProgram = null;
        }
        skyboxUniforms = null;
        skyboxBlend = clampUnitInterval(0.0);
    }

    function renderSkyboxPass(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        devicePixelRatio: DevicePixelRatio,
        cameraBuffer: CameraUniformBuffer
    ): void {
        if (!skyboxProgram || !skyboxVertexArray || !skyboxUniforms) {
            return;
        }
        glContext.disable(glContext.BLEND);
        glContext.useProgram(skyboxProgram);
        glContext.bindVertexArray(skyboxVertexArray);
        glContext.uniform2f(
            skyboxUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1f(
            skyboxUniforms.devicePixelRatio,
            devicePixelRatio
        );
        glContext.uniform4fv(skyboxUniforms.camera, cameraBuffer);
        glContext.uniform1f(skyboxUniforms.time, skyboxTimeSeconds);
        glContext.uniform4fv(skyboxUniforms.skySeed, skySeedVector);
        glContext.drawArrays(glContext.TRIANGLES, 0, 3);
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);
    }

    function bindUnitQuadVertexArray(
        shaderProgram: WebGLProgram
    ): WebGLVertexArrayObject | null {
        const vertexArray: WebGLVertexArrayObject | null =
            glContext.createVertexArray();
        if (!vertexArray) {
            return null;
        }
        glContext.bindVertexArray(vertexArray);
        glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
        const quadLocation: GLint = glContext.getAttribLocation(
            shaderProgram,
            "a_quad"
        );
        if (quadLocation < 0) {
            glContext.deleteVertexArray(vertexArray);
            return null;
        }
        glContext.enableVertexAttribArray(quadLocation);
        glContext.vertexAttribPointer(
            quadLocation,
            2,
            glContext.FLOAT,
            false,
            0,
            0
        );
        return vertexArray;
    }

    function renderKeypadPass(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        devicePixelRatio: DevicePixelRatio,
        cameraBuffer: CameraUniformBuffer,
        keypadBuffer: KeypadUniformBuffer | null,
        isKeypadReady: boolean
    ): void {
        if (
            !isKeypadReady ||
            !keypadProgram ||
            !keypadVertexArray ||
            !keypadUniforms ||
            !projectKeypadQuadFunction ||
            !keypadBuffer
        ) {
            return;
        }
        const boundsRect: QuadBoundsTuple = projectKeypadQuadFunction(
            viewportWidth,
            viewportHeight,
            cameraBuffer,
            keypadBuffer
        );
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);
        glContext.useProgram(keypadProgram);
        glContext.bindVertexArray(keypadVertexArray);

        glContext.uniform2f(
            keypadUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1f(
            keypadUniforms.devicePixelRatio,
            devicePixelRatio
        );
        glContext.uniform4f(
            keypadUniforms.boundsRect,
            boundsRect[0],
            boundsRect[1],
            boundsRect[2],
            boundsRect[3]
        );
        glContext.uniform4fv(keypadUniforms.camera, cameraBuffer);
        glContext.uniform4fv(keypadUniforms.keypad, keypadBuffer);

        glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        glContext.disable(glContext.BLEND);
    }

    function renderPortalVortexQuads(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        devicePixelRatio: DevicePixelRatio,
        cameraBuffer: CameraUniformBuffer,
        activePortalCount: ElementCount,
        portalsBuffer: PortalsUniformBuffer,
        ringsBuffer: PortalRingsBuffer
    ): void {
        if (!portalProgram || !portalVertexArray || !portalUniforms) {
            return;
        }
        glContext.useProgram(portalProgram);
        glContext.bindVertexArray(portalVertexArray);
        glContext.uniform2f(
            portalUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1f(portalUniforms.devicePixelRatio, devicePixelRatio);
        glContext.uniform4fv(portalUniforms.camera, cameraBuffer);

        for (
            let portalIndex: number = 0;
            portalIndex < activePortalCount;
            portalIndex++
        ) {
            const portalOffset: number = portalIndex * PORTAL_FLOATS;
            const ringOffset: number = portalIndex * RING_FLOATS_PER_PORTAL;
            const radiusX: CssPixels = asCssPixels(
                portalsBuffer[portalOffset + 2]
            );
            const radiusY: CssPixels = asCssPixels(
                portalsBuffer[portalOffset + 3]
            );
            if (radiusX <= 2.0 || radiusY <= 2.0) {
                continue;
            }
            const centerX: CssPixels = asCssPixels(
                portalsBuffer[portalOffset]
            );
            const centerY: CssPixels = asCssPixels(
                portalsBuffer[portalOffset + 1]
            );
            const singlePortalSlice: Float32Array = portalsBuffer.subarray(
                portalOffset,
                portalOffset + PORTAL_FLOATS
            );
            const singleRingsSlice: Float32Array = ringsBuffer.subarray(
                ringOffset,
                ringOffset + RING_FLOATS_PER_PORTAL
            );
            const phaseOffset: Radians = asRadians(portalIndex * 2.35);

            glContext.uniform4f(
                portalUniforms.boundsRect,
                centerX,
                centerY,
                radiusX * 1.38,
                radiusY * 1.38
            );
            glContext.uniform4fv(portalUniforms.portal, singlePortalSlice);
            glContext.uniform4fv(portalUniforms.rings, singleRingsSlice);
            glContext.uniform1f(portalUniforms.phaseOffset, phaseOffset);
            glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        }
    }

    function renderPortalParticles(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        particleCount: ElementCount,
        particlesBuffer: ParticlesInstanceBuffer | null
    ): void {
        if (
            !particleProgram ||
            !particleVertexArray ||
            !instanceBuffer ||
            particleCount <= 0 ||
            !particlesBuffer
        ) {
            return;
        }
        glContext.blendFunc(glContext.ONE, glContext.ONE);
        glContext.useProgram(particleProgram);
        glContext.bindVertexArray(particleVertexArray);
        glContext.uniform2f(
            particleResolutionLocation,
            viewportWidth,
            viewportHeight
        );

        glContext.bindBuffer(glContext.ARRAY_BUFFER, instanceBuffer);
        if (instanceCapacity < particleCount) {
            instanceCapacity = particleCount;
            glContext.bufferData(
                glContext.ARRAY_BUFFER,
                particlesBuffer.byteLength,
                glContext.DYNAMIC_DRAW
            );
        }
        glContext.bufferSubData(glContext.ARRAY_BUFFER, 0, particlesBuffer);
        glContext.drawArraysInstanced(
            glContext.TRIANGLES,
            0,
            6,
            particleCount
        );
    }

    function renderPortalLabels(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        portalCount: ElementCount,
        activePortalCount: ElementCount,
        portalsBuffer: PortalsUniformBuffer
    ): void {
        if (
            !labelProgram ||
            !labelVertexArray ||
            !labelUniforms ||
            !labelManager ||
            labelManager.slots.length < portalCount
        ) {
            return;
        }
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);
        glContext.useProgram(labelProgram);
        glContext.bindVertexArray(labelVertexArray);
        glContext.activeTexture(glContext.TEXTURE0);
        glContext.uniform2f(
            labelUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1i(labelUniforms.texture, 0);

        for (
            let portalIndex: number = 0;
            portalIndex < activePortalCount;
            portalIndex++
        ) {
            const labelSlot: LabelSlot | undefined =
                labelManager.slots[portalIndex];
            if (!labelSlot || !labelSlot.isReady) {
                continue;
            }
            const portalOffset: number = portalIndex * PORTAL_FLOATS;
            const radiusY: CssPixels = asCssPixels(
                portalsBuffer[portalOffset + 3]
            );
            if (radiusY <= 2.0) {
                continue;
            }
            const centerX: CssPixels = asCssPixels(
                portalsBuffer[portalOffset]
            );
            const centerY: CssPixels = asCssPixels(
                portalsBuffer[portalOffset + 1]
            );
            const rawAlpha: number = portalsBuffer[portalOffset + 9];
            const clampedAlpha: UnitInterval = clampUnitInterval(rawAlpha);

            const halfHeight: CssPixels = asCssPixels(radiusY * 0.68);
            const halfWidth: CssPixels = asCssPixels(
                halfHeight * labelManager.aspectRatio
            );
            const labelCenterY: CssPixels = asCssPixels(
                centerY - radiusY * 1.36
            );

            glContext.bindTexture(glContext.TEXTURE_2D, labelSlot.texture);
            glContext.uniform4f(
                labelUniforms.boundsRect,
                centerX,
                labelCenterY,
                halfWidth,
                halfHeight
            );
            glContext.uniform1f(labelUniforms.alpha, clampedAlpha);
            glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        }
    }

    function renderPortalsPass(
        viewportWidth: CssPixels,
        viewportHeight: CssPixels,
        devicePixelRatio: DevicePixelRatio,
        cameraBuffer: CameraUniformBuffer,
        portalCount: ElementCount,
        activePortalCount: ElementCount,
        portalsBuffer: PortalsUniformBuffer | null,
        ringsBuffer: PortalRingsBuffer | null,
        particleCount: ElementCount,
        particlesBuffer: ParticlesInstanceBuffer | null
    ): void {
        if (activePortalCount <= 0 || !portalsBuffer || !ringsBuffer) {
            return;
        }
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);

        renderPortalVortexQuads(
            viewportWidth,
            viewportHeight,
            devicePixelRatio,
            cameraBuffer,
            activePortalCount,
            portalsBuffer,
            ringsBuffer
        );
        renderPortalParticles(
            viewportWidth,
            viewportHeight,
            particleCount,
            particlesBuffer
        );
        renderPortalLabels(
            viewportWidth,
            viewportHeight,
            portalCount,
            activePortalCount,
            portalsBuffer
        );

        glContext.disable(glContext.BLEND);
    }

    return {
        areEntitiesReady(): boolean {
            if (sceneMode === SCENE_KEYPAD) {
                return Boolean(keypadProgram);
            }
            if (sceneMode === SCENE_PORTALS) {
                return Boolean(portalProgram);
            }
            return true;
        },
        setLightMode(nextLightMode: boolean): void {
            isLightModeActive = Boolean(nextLightMode);
            if (labelManager) {
                labelManager.setLightMode(isLightModeActive);
            }
        },
        setSkyboxAllowed(allowed: boolean): void {
            isSkyboxAllowed = Boolean(allowed);
            if (!isSkyboxAllowed) {
                skyboxBlend = clampUnitInterval(0.0);
            }
        },
        stepSkybox(scaledDeltaSeconds: Seconds): void {
            skyboxTimeSeconds = asSeconds(
                (skyboxTimeSeconds + scaledDeltaSeconds) % 36000.0
            );
            if (skyboxProgram && isSkyboxAllowed && skyboxBlend < 1.0) {
                skyboxBlend = clampUnitInterval(
                    skyboxBlend + scaledDeltaSeconds * 2.85
                );
            }
        },
        beginSkyboxTransition(): SkyboxGeneration {
            activeSkyboxGeneration = asSkyboxGeneration(
                activeSkyboxGeneration + 1
            );
            disposeActiveSkybox();
            populateSkySeedVector(skySeedVector);
            return activeSkyboxGeneration;
        },
        attachSkyboxModule(
            skyboxModule: SkyboxShaderModule,
            requestGeneration: SkyboxGeneration
        ): void {
            if (!skyboxModule || !skyboxModule.SKYBOX_FRAGMENT_SHADER_SOURCE) {
                return;
            }
            const job: AsynchronousProgramJob = startAsynchronousProgram(
                glContext,
                parallelCompileExtension,
                FULLSCREEN_TRIANGLE_VERTEX_SHADER,
                skyboxModule.SKYBOX_FRAGMENT_SHADER_SOURCE,
                (shaderProgram: WebGLProgram): void => {
                    if (requestGeneration !== activeSkyboxGeneration) {
                        glContext.deleteProgram(shaderProgram);
                        return;
                    }
                    const vertexArray: WebGLVertexArrayObject | null =
                        bindFullscreenVertexArray(shaderProgram);
                    if (!vertexArray) {
                        glContext.deleteProgram(shaderProgram);
                        return;
                    }
                    disposeActiveSkybox();
                    skyboxProgram = shaderProgram;
                    skyboxVertexArray = vertexArray;
                    skyboxUniforms = {
                        resolution: glContext.getUniformLocation(
                            shaderProgram,
                            "u_resolution"
                        ),
                        devicePixelRatio: glContext.getUniformLocation(
                            shaderProgram,
                            "u_device_pixel_ratio"
                        ),
                        camera: glContext.getUniformLocation(
                            shaderProgram,
                            "u_camera[0]"
                        ),
                        time: glContext.getUniformLocation(
                            shaderProgram,
                            "u_time"
                        ),
                        skySeed: glContext.getUniformLocation(
                            shaderProgram,
                            "u_sky_seed"
                        ),
                    };
                    skyboxBlend = clampUnitInterval(0.0);
                }
            );
            asynchronousJobs.push(job);
        },
        attachKeypadModule(keypadModule: KeypadShaderModule): void {
            projectKeypadQuadFunction = keypadModule.projectKeypadQuad;
            const job: AsynchronousProgramJob = startAsynchronousProgram(
                glContext,
                parallelCompileExtension,
                BOUNDED_QUAD_VERTEX_SHADER,
                keypadModule.KEYPAD_FRAGMENT_SHADER_SOURCE,
                (shaderProgram: WebGLProgram): void => {
                    const vertexArray: WebGLVertexArrayObject | null =
                        bindUnitQuadVertexArray(shaderProgram);
                    if (!vertexArray) {
                        return;
                    }
                    keypadProgram = shaderProgram;
                    keypadVertexArray = vertexArray;
                    const locations: KeypadUniformLocations = {
                        resolution: glContext.getUniformLocation(
                            shaderProgram,
                            "u_resolution"
                        ),
                        devicePixelRatio: glContext.getUniformLocation(
                            shaderProgram,
                            "u_device_pixel_ratio"
                        ),
                        zero: glContext.getUniformLocation(
                            shaderProgram,
                            "u_zero"
                        ),
                        boundsRect: glContext.getUniformLocation(
                            shaderProgram,
                            "u_bounds_rect"
                        ),
                        camera: glContext.getUniformLocation(
                            shaderProgram,
                            "u_camera[0]"
                        ),
                        keypad: glContext.getUniformLocation(
                            shaderProgram,
                            "u_keypad[0]"
                        ),
                    };
                    keypadUniforms = locations;
                    glContext.useProgram(shaderProgram);
                    glContext.uniform1i(locations.zero, 0);
                }
            );
            asynchronousJobs.push(job);
        },
        attachPortalsModule(portalsModule: PortalsShaderModule): void {
            const vortexJob: AsynchronousProgramJob = startAsynchronousProgram(
                glContext,
                parallelCompileExtension,
                BOUNDED_QUAD_VERTEX_SHADER,
                portalsModule.PORTAL_FRAGMENT_SHADER_SOURCE,
                (shaderProgram: WebGLProgram): void => {
                    const vertexArray: WebGLVertexArrayObject | null =
                        bindUnitQuadVertexArray(shaderProgram);
                    if (!vertexArray) {
                        return;
                    }
                    portalProgram = shaderProgram;
                    portalVertexArray = vertexArray;
                    const locations: PortalUniformLocations = {
                        resolution: glContext.getUniformLocation(
                            shaderProgram,
                            "u_resolution"
                        ),
                        devicePixelRatio: glContext.getUniformLocation(
                            shaderProgram,
                            "u_device_pixel_ratio"
                        ),
                        zero: glContext.getUniformLocation(
                            shaderProgram,
                            "u_zero"
                        ),
                        boundsRect: glContext.getUniformLocation(
                            shaderProgram,
                            "u_bounds_rect"
                        ),
                        camera: glContext.getUniformLocation(
                            shaderProgram,
                            "u_camera[0]"
                        ),
                        portal: glContext.getUniformLocation(
                            shaderProgram,
                            "u_portal[0]"
                        ),
                        rings: glContext.getUniformLocation(
                            shaderProgram,
                            "u_portal_rings[0]"
                        ),
                        phaseOffset: glContext.getUniformLocation(
                            shaderProgram,
                            "u_phase_offset"
                        ),
                    };
                    portalUniforms = locations;
                    glContext.useProgram(shaderProgram);
                    glContext.uniform1i(locations.zero, 0);
                }
            );
            asynchronousJobs.push(vortexJob);

            const particleJob: AsynchronousProgramJob =
                startAsynchronousProgram(
                    glContext,
                    parallelCompileExtension,
                    portalsModule.PARTICLE_VERTEX_SHADER_SOURCE,
                    portalsModule.PARTICLE_FRAGMENT_SHADER_SOURCE,
                    (shaderProgram: WebGLProgram): void => {
                        const vertexArray: WebGLVertexArrayObject | null =
                            glContext.createVertexArray();
                        const particleInstanceBuffer: WebGLBuffer | null =
                            glContext.createBuffer();
                        if (!vertexArray || !particleInstanceBuffer) {
                            return;
                        }
                        glContext.bindVertexArray(vertexArray);
                        glContext.bindBuffer(
                            glContext.ARRAY_BUFFER,
                            quadBuffer
                        );
                        const quadLocation: GLint =
                            glContext.getAttribLocation(
                                shaderProgram,
                                "a_quad"
                            );
                        const geometryLocation: GLint =
                            glContext.getAttribLocation(
                                shaderProgram,
                                "a_particle_geometry"
                            );
                        const appearanceLocation: GLint =
                            glContext.getAttribLocation(
                                shaderProgram,
                                "a_particle_appearance"
                            );
                        if (
                            quadLocation < 0 ||
                            geometryLocation < 0 ||
                            appearanceLocation < 0
                        ) {
                            return;
                        }
                        glContext.enableVertexAttribArray(quadLocation);
                        glContext.vertexAttribPointer(
                            quadLocation,
                            2,
                            glContext.FLOAT,
                            false,
                            0,
                            0
                        );

                        glContext.bindBuffer(
                            glContext.ARRAY_BUFFER,
                            particleInstanceBuffer
                        );
                        const byteStride: ByteCount = asByteCount(
                            PARTICLE_FLOATS * 4
                        );
                        glContext.enableVertexAttribArray(geometryLocation);
                        glContext.vertexAttribPointer(
                            geometryLocation,
                            4,
                            glContext.FLOAT,
                            false,
                            byteStride,
                            0
                        );
                        glContext.vertexAttribDivisor(geometryLocation, 1);

                        glContext.enableVertexAttribArray(appearanceLocation);
                        glContext.vertexAttribPointer(
                            appearanceLocation,
                            4,
                            glContext.FLOAT,
                            false,
                            byteStride,
                            16
                        );
                        glContext.vertexAttribDivisor(appearanceLocation, 1);

                        particleProgram = shaderProgram;
                        particleVertexArray = vertexArray;
                        instanceBuffer = particleInstanceBuffer;
                        particleResolutionLocation =
                            glContext.getUniformLocation(
                                shaderProgram,
                                "u_resolution"
                            );
                    }
                );
            asynchronousJobs.push(particleJob);

            const labelJob: AsynchronousProgramJob = startAsynchronousProgram(
                glContext,
                parallelCompileExtension,
                BOUNDED_QUAD_VERTEX_SHADER,
                portalsModule.LABEL_FRAGMENT_SHADER_SOURCE,
                (shaderProgram: WebGLProgram): void => {
                    const vertexArray: WebGLVertexArrayObject | null =
                        bindUnitQuadVertexArray(shaderProgram);
                    const manager: LabelManager | null =
                        portalsModule.createLabelManager(
                            glContext,
                            isLightModeActive
                        );
                    if (!vertexArray || !manager) {
                        return;
                    }
                    labelProgram = shaderProgram;
                    labelVertexArray = vertexArray;
                    labelManager = manager;
                    labelUniforms = {
                        resolution: glContext.getUniformLocation(
                            shaderProgram,
                            "u_resolution"
                        ),
                        boundsRect: glContext.getUniformLocation(
                            shaderProgram,
                            "u_bounds_rect"
                        ),
                        texture: glContext.getUniformLocation(
                            shaderProgram,
                            "u_texture"
                        ),
                        alpha: glContext.getUniformLocation(
                            shaderProgram,
                            "u_alpha"
                        ),
                    };
                }
            );
            asynchronousJobs.push(labelJob);
        },
        pollAsynchronousJobs(): boolean {
            let linkedAnyProgram: boolean = false;
            for (
                let jobIndex: number = 0;
                jobIndex < asynchronousJobs.length;
                jobIndex++
            ) {
                if (asynchronousJobs[jobIndex].poll()) {
                    linkedAnyProgram = true;
                }
            }
            return linkedAnyProgram;
        },
        synchronizeLabels(
            portalCount: ElementCount,
            metadataView: PortalMetadataBuffer
        ): void {
            if (!labelManager) {
                return;
            }
            labelManager.synchronize(portalCount, metadataView);
        },
        render(
            viewportWidth: CssPixels,
            viewportHeight: CssPixels,
            devicePixelRatio: DevicePixelRatio,
            cameraBuffer: CameraUniformBuffer,
            keypadBuffer: KeypadUniformBuffer | null,
            portalCount: ElementCount,
            portalsBuffer: PortalsUniformBuffer | null,
            ringsBuffer: PortalRingsBuffer | null,
            particleCount: ElementCount,
            particlesBuffer: ParticlesInstanceBuffer | null
        ): boolean {
            if (glContext.isContextLost()) {
                return false;
            }

            const activePortalCount: ElementCount = portalProgram
                ? portalCount
                : asElementCount(0);
            if (activePortalCount > 0 && portalsBuffer && ringsBuffer) {
                paddedPortals.fill(0);
                paddedRings.fill(0);
                const portalFloatCount: number =
                    activePortalCount * PORTAL_FLOATS;
                paddedPortals.set(
                    portalsBuffer.subarray(0, portalFloatCount)
                );
                const ringFloatCount: number =
                    activePortalCount * RING_FLOATS_PER_PORTAL;
                paddedRings.set(ringsBuffer.subarray(0, ringFloatCount));
            }

            const isKeypadReady: boolean = Boolean(
                keypadProgram &&
                    projectKeypadQuadFunction &&
                    keypadBuffer &&
                    keypadBuffer[7] > 0.5
            );

            const effectiveSkyboxMix: UnitInterval =
                skyboxProgram && isSkyboxAllowed
                    ? skyboxBlend
                    : clampUnitInterval(0.0);

            glContext.viewport(0, 0, stage.width, stage.height);
            glContext.disable(glContext.BLEND);
            if (effectiveSkyboxMix > 0.001) {
                renderSkyboxPass(
                    viewportWidth,
                    viewportHeight,
                    devicePixelRatio,
                    cameraBuffer
                );
            }
            glContext.useProgram(gridProgram);
            glContext.bindVertexArray(gridVertexArray);

            glContext.uniform2f(
                gridUniforms.resolution,
                viewportWidth,
                viewportHeight
            );
            glContext.uniform1f(
                gridUniforms.devicePixelRatio,
                devicePixelRatio
            );
            glContext.uniform4fv(gridUniforms.camera, cameraBuffer);
            glContext.uniform1f(gridUniforms.skyboxMix, effectiveSkyboxMix);
            if (gridUniforms.portalCount !== null) {
                glContext.uniform1i(
                    gridUniforms.portalCount,
                    activePortalCount
                );
                glContext.uniform4fv(gridUniforms.portals, paddedPortals);
                glContext.uniform4fv(gridUniforms.rings, paddedRings);
            }
            if (gridUniforms.keypadFloor !== null) {
                const floorX: number =
                    isKeypadReady && keypadBuffer ? keypadBuffer[0] : 0.0;
                const floorZ: number =
                    isKeypadReady && keypadBuffer ? keypadBuffer[2] : 0.0;
                const floorVisibility: number =
                    isKeypadReady && keypadBuffer ? keypadBuffer[15] : 0.0;
                const floorHover: number =
                    isKeypadReady && keypadBuffer ? keypadBuffer[11] : 0.0;
                glContext.uniform4f(
                    gridUniforms.keypadFloor,
                    floorX,
                    floorZ,
                    floorVisibility,
                    floorHover
                );
            }

            glContext.drawArrays(glContext.TRIANGLES, 0, 3);
            glContext.disable(glContext.BLEND);

            renderKeypadPass(
                viewportWidth,
                viewportHeight,
                devicePixelRatio,
                cameraBuffer,
                keypadBuffer,
                isKeypadReady
            );
            renderPortalsPass(
                viewportWidth,
                viewportHeight,
                devicePixelRatio,
                cameraBuffer,
                portalCount,
                activePortalCount,
                portalsBuffer,
                ringsBuffer,
                particleCount,
                particlesBuffer
            );

            return true;
        },
        dispose(): void {
            try {
                if (labelManager) {
                    labelManager.dispose();
                }
                for (
                    let jobIndex: number = 0;
                    jobIndex < asynchronousJobs.length;
                    jobIndex++
                ) {
                    asynchronousJobs[jobIndex].dispose();
                }
                disposeActiveSkybox();
                if (keypadVertexArray) {
                    glContext.deleteVertexArray(keypadVertexArray);
                }
                if (portalVertexArray) {
                    glContext.deleteVertexArray(portalVertexArray);
                }
                if (labelVertexArray) {
                    glContext.deleteVertexArray(labelVertexArray);
                }
                if (particleVertexArray) {
                    glContext.deleteVertexArray(particleVertexArray);
                }
                if (instanceBuffer) {
                    glContext.deleteBuffer(instanceBuffer);
                }
                glContext.deleteBuffer(quadBuffer);
                glContext.deleteBuffer(triangleBuffer);
                glContext.deleteVertexArray(gridVertexArray);
                glContext.deleteProgram(gridProgram);
                const loseContextExtension: WEBGL_lose_context | null =
                    glContext.getExtension("WEBGL_lose_context");
                if (loseContextExtension) {
                    loseContextExtension.loseContext();
                }
            } catch {}
        },
    };
}

function resolveSceneMode(stage: HTMLCanvasElement): SceneMode {
    const sceneAttribute: string = stage.getAttribute("data-scene") || "";
    const portalAttribute: string = stage.getAttribute("data-portal") || "";
    if (sceneAttribute === "portals" || portalAttribute === "1") {
        return SCENE_PORTALS;
    }
    if (sceneAttribute === "keypad") {
        return SCENE_KEYPAD;
    }
    return SCENE_GRID;
}

function resolveCustomSkyboxId(
    stage: HTMLCanvasElement
): CustomSkyboxId | null {
    const rawAttribute: string = stage.getAttribute("data-skybox") || "";
    const trimmedId: string = rawAttribute.trim();
    if (!/^[a-z0-9-]{1,48}$/.test(trimmedId)) {
        return null;
    }
    return trimmedId as CustomSkyboxId;
}

function rollThemeSkyboxId(isLightMode: boolean): ThemeSkyboxId {
    const pool: readonly ThemeSkyboxId[] = isLightMode
        ? LIGHT_SKYBOX_IDS
        : DARK_SKYBOX_IDS;
    const seed: RandomSeed = generateRandomSeed();
    const selectedIndex: number = seed % pool.length;
    const chosenSkybox: ThemeSkyboxId = pool[selectedIndex];
    return chosenSkybox;
}

function setupModulePrefetch(abortSignal: AbortSignal): void {
    let isKeypadWarmed: boolean = false;
    let isPortalsWarmed: boolean = false;

    document.addEventListener(
        "pointerover",
        (pointerEvent: PointerEvent): void => {
            const eventTarget: EventTarget | null = pointerEvent.target;
            if (!(eventTarget instanceof Element)) {
                return;
            }
            const anchorElement: Element | null =
                eventTarget.closest("a[href]");
            if (!anchorElement) {
                return;
            }
            const targetHref: string =
                anchorElement.getAttribute("href") || "";
            const isHomeRoute: boolean =
                targetHref === "/" || /^\/(es|fr|de|ja)\/$/.test(targetHref);
            if (isHomeRoute && !isKeypadWarmed) {
                isKeypadWarmed = true;
                import("./keypad.ts").catch((): null => null);
                return;
            }
            if (targetHref.endsWith("/ugce/") && !isPortalsWarmed) {
                isPortalsWarmed = true;
                import("./portals.ts").catch((): null => null);
            }
        },
        { passive: true, signal: abortSignal }
    );
}

function readPortalFrameViews(
    wasmExports: WasmStageExports,
    stageRenderer: StageRenderer,
    portalCount: ElementCount,
    particleCount: ElementCount
): PortalFrameViews | null {
    if (portalCount <= 0) {
        return { portalsView: null, ringsView: null, particlesView: null };
    }
    const portalFloatsTotal: ElementCount = asElementCount(
        portalCount * PORTAL_FLOATS
    );
    const ringFloatsTotal: ElementCount = asElementCount(
        portalCount * RING_FLOATS_PER_PORTAL
    );
    const metadataTotal: ElementCount = asElementCount(
        portalCount * METADATA_U32S_PER_PORTAL
    );
    const portalsView: PortalsUniformBuffer | null =
        readTypedFloat32Buffer<PortalsUniformBuffer>(
            wasmExports.memory,
            wasmExports.get_portals_pointer(),
            portalFloatsTotal
        );
    const ringsView: PortalRingsBuffer | null =
        readTypedFloat32Buffer<PortalRingsBuffer>(
            wasmExports.memory,
            wasmExports.get_rings_pointer(),
            ringFloatsTotal
        );
    const metadataView: PortalMetadataBuffer | null = readPortalMetadataBuffer(
        wasmExports.memory,
        wasmExports.get_portal_metadata_pointer(),
        metadataTotal
    );
    if (!portalsView || !ringsView || !metadataView) {
        return null;
    }
    stageRenderer.synchronizeLabels(portalCount, metadataView);

    if (particleCount <= 0) {
        return { portalsView, ringsView, particlesView: null };
    }
    const particleFloatsTotal: ElementCount = asElementCount(
        particleCount * PARTICLE_FLOATS
    );
    const particlesView: ParticlesInstanceBuffer | null =
        readTypedFloat32Buffer<ParticlesInstanceBuffer>(
            wasmExports.memory,
            wasmExports.get_particles_pointer(),
            particleFloatsTotal
        );
    if (!particlesView) {
        return null;
    }
    return { portalsView, ringsView, particlesView };
}

function initializeStage(): void {
    const stageElement: HTMLElement | null = document.getElementById("stage");
    if (!(stageElement instanceof HTMLCanvasElement)) {
        return;
    }
    const stage: HTMLCanvasElement = stageElement;

    const containerElement: Element | null = stage.closest(".site-stage");
    if (!(containerElement instanceof HTMLElement)) {
        return;
    }
    const stageContainer: HTMLElement = containerElement;

    const surfaceElement: HTMLElement | null =
        document.getElementById("stage-surface");
    if (!(surfaceElement instanceof HTMLElement)) {
        return;
    }
    const stageSurface: HTMLElement = surfaceElement;

    const stageLinkElement: HTMLElement | null =
        document.getElementById("stage-link");
    const stageLink: HTMLAnchorElement | null =
        stageLinkElement instanceof HTMLAnchorElement
            ? stageLinkElement
            : null;

    const colorSchemeQuery: MediaQueryList | null =
        typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-color-scheme: light)")
            : null;
    let isLightMode: boolean = Boolean(
        colorSchemeQuery && colorSchemeQuery.matches
    );
    const customSkyboxId: CustomSkyboxId | null = resolveCustomSkyboxId(stage);

    const sceneMode: SceneMode = resolveSceneMode(stage);
    const keypadModulePromise: Promise<KeypadShaderModule | null> | null =
        sceneMode === SCENE_KEYPAD
            ? import("./keypad.ts").catch((): null => null)
            : null;
    const portalsModulePromise: Promise<PortalsShaderModule | null> | null =
        sceneMode === SCENE_PORTALS
            ? import("./portals.ts").catch((): null => null)
            : null;

    const maybeRenderer: StageRenderer | null = createStageRenderer(
        stage,
        sceneMode,
        isLightMode
    );
    if (!maybeRenderer) {
        return;
    }
    const stageRenderer: StageRenderer = maybeRenderer;

    const abortController: AbortController = new AbortController();
    const abortSignal: AbortSignal = abortController.signal;
    setupModulePrefetch(abortSignal);

    let maximumDevicePixelRatio: DevicePixelRatio = asDevicePixelRatio(
        Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
    );
    let cssWidth: CssPixels = asCssPixels(1);
    let cssHeight: CssPixels = asCssPixels(1);
    let devicePixelRatio: DevicePixelRatio = maximumDevicePixelRatio;
    let animationFrameId: AnimationFrameHandle = asAnimationFrameHandle(0);
    let previousTimestamp: Milliseconds = asMilliseconds(performance.now());
    let isStopped: boolean = false;

    let wasmExports: WasmStageExports | null = null;
    let portalCount: ElementCount = asElementCount(0);
    let particleCount: ElementCount = asElementCount(0);
    let pendingPointerPosition: ScreenPointTuple | null = null;
    let pendingTouchPosition: TouchInputTuple | null = null;
    const fallbackCameraBuffer: CameraUniformBuffer =
        createInitialCameraBuffer();

    function scheduleAnimationFrame(): void {
        if (isStopped || document.hidden) {
            return;
        }
        cancelAnimationFrame(animationFrameId);
        const handle: number = requestAnimationFrame(renderAnimationFrame);
        animationFrameId = asAnimationFrameHandle(handle);
    }

    function clampStageDimension(rawPixelSize: number): DevicePixels {
        const clamped: number = Math.min(
            MAXIMUM_STAGE_DIMENSION,
            Math.max(1, Math.round(rawPixelSize))
        );
        return asDevicePixels(clamped);
    }

    function measureStageContainer(): boolean {
        const containerBounds: DOMRect =
            stageContainer.getBoundingClientRect();
        if (
            Number.isFinite(containerBounds.width) &&
            containerBounds.width > 0
        ) {
            cssWidth = asCssPixels(Math.max(1, containerBounds.width));
        }
        if (
            Number.isFinite(containerBounds.height) &&
            containerBounds.height > 0
        ) {
            cssHeight = asCssPixels(Math.max(1, containerBounds.height));
        }
        devicePixelRatio = maximumDevicePixelRatio;
        const targetWidth: DevicePixels = clampStageDimension(
            cssWidth * devicePixelRatio
        );
        const targetHeight: DevicePixels = clampStageDimension(
            cssHeight * devicePixelRatio
        );
        const didResizeBuffer: boolean =
            stage.width !== targetWidth || stage.height !== targetHeight;
        if (didResizeBuffer) {
            stage.width = targetWidth;
            stage.height = targetHeight;
        }
        applyFallbackWideFraming(fallbackCameraBuffer, cssWidth, cssHeight);
        return didResizeBuffer;
    }

    measureStageContainer();
    const initialFrameRendered: boolean = stageRenderer.render(
        cssWidth,
        cssHeight,
        devicePixelRatio,
        fallbackCameraBuffer,
        null,
        asElementCount(0),
        null,
        null,
        asElementCount(0),
        null
    );
    if (initialFrameRendered) {
        stage.classList.add("stage--ready");
    }

    function attachLoadedKeypadModule(
        keypadModule: KeypadShaderModule | null
    ): void {
        if (isStopped || !keypadModule) {
            return;
        }
        stageRenderer.attachKeypadModule(keypadModule);
        scheduleAnimationFrame();
    }

    function attachLoadedPortalsModule(
        portalsModule: PortalsShaderModule | null
    ): void {
        if (isStopped || !portalsModule) {
            return;
        }
        stageRenderer.attachPortalsModule(portalsModule);
        scheduleAnimationFrame();
    }

    if (keypadModulePromise) {
        keypadModulePromise.then(attachLoadedKeypadModule);
    }
    if (portalsModulePromise) {
        portalsModulePromise.then(attachLoadedPortalsModule);
    }

    function attachLoadedSkyboxModule(
        skyboxModule: unknown,
        requestGeneration: SkyboxGeneration
    ): void {
        if (isStopped || !isSkyboxShaderModule(skyboxModule)) {
            return;
        }
        stageRenderer.attachSkyboxModule(skyboxModule, requestGeneration);
        scheduleAnimationFrame();
    }

    function requestSkyboxModule(skyboxId: SkyboxId): void {
        if (!skyboxId || isStopped) {
            return;
        }
        const generation: SkyboxGeneration =
            stageRenderer.beginSkyboxTransition();
        import(`./skyboxes/${skyboxId}.ts`)
            .catch((): null => null)
            .then((skyboxModule: unknown): void => {
                attachLoadedSkyboxModule(skyboxModule, generation);
            });
    }

    const initialSkyboxId: SkyboxId =
        customSkyboxId ?? rollThemeSkyboxId(isLightMode);
    requestSkyboxModule(initialSkyboxId);

    function handleColorSchemeChange(changeEvent: MediaQueryListEvent): void {
        if (isStopped) {
            return;
        }
        isLightMode = Boolean(changeEvent.matches);
        stageRenderer.setLightMode(isLightMode);
        if (!customSkyboxId) {
            const nextThemeSkybox: ThemeSkyboxId =
                rollThemeSkyboxId(isLightMode);
            requestSkyboxModule(nextThemeSkybox);
        }
        scheduleAnimationFrame();
    }

    if (colorSchemeQuery) {
        colorSchemeQuery.addEventListener("change", handleColorSchemeChange, {
            signal: abortSignal,
        });
    }

    function attachLoadedWasm(loadedExports: WasmStageExports | null): void {
        if (isStopped || !loadedExports) {
            return;
        }
        try {
            const initialSeed: RandomSeed = generateRandomSeed();
            loadedExports.initialize_scene(
                cssWidth,
                cssHeight,
                sceneMode,
                initialSeed
            );
            const rawPortalCount: ElementCount =
                loadedExports.get_portal_count();
            portalCount = asElementCount(
                Math.min(MAXIMUM_PORTALS, Math.max(0, rawPortalCount))
            );
            const rawParticleCount: ElementCount =
                loadedExports.get_particle_count();
            const clampedParticles: number =
                portalCount > 0
                    ? Math.min(512, Math.max(0, rawParticleCount))
                    : 0;
            particleCount = asElementCount(clampedParticles);
            if (pendingTouchPosition) {
                loadedExports.touch_move(
                    pendingTouchPosition[0],
                    pendingTouchPosition[1],
                    pendingTouchPosition[2],
                    pendingTouchPosition[3]
                );
            } else if (pendingPointerPosition) {
                loadedExports.pointer_move(
                    pendingPointerPosition[0],
                    pendingPointerPosition[1]
                );
            }
            wasmExports = loadedExports;
            scheduleAnimationFrame();
        } catch {
            shutdownToFallback();
        }
    }

    INITIAL_WASM_PROMISE.then(attachLoadedWasm);

    const motionScale: number = 1.0;

    function drawCurrentWasmViews(): boolean {
        if (!wasmExports) {
            return false;
        }
        const cameraView: CameraUniformBuffer | null =
            readTypedFloat32Buffer<CameraUniformBuffer>(
                wasmExports.memory,
                wasmExports.get_camera_pointer(),
                CAMERA_FLOATS
            );
        const keypadView: KeypadUniformBuffer | null =
            readTypedFloat32Buffer<KeypadUniformBuffer>(
                wasmExports.memory,
                wasmExports.get_keypad_pointer(),
                KEYPAD_FLOATS
            );
        const portalViews: PortalFrameViews | null = readPortalFrameViews(
            wasmExports,
            stageRenderer,
            portalCount,
            particleCount
        );
        if (!cameraView || !keypadView || !portalViews) {
            return false;
        }
        return stageRenderer.render(
            cssWidth,
            cssHeight,
            devicePixelRatio,
            cameraView,
            keypadView,
            portalCount,
            portalViews.portalsView,
            portalViews.ringsView,
            particleCount,
            portalViews.particlesView
        );
    }

    function redrawAfterResize(): void {
        if (!wasmExports) {
            stageRenderer.render(
                cssWidth,
                cssHeight,
                devicePixelRatio,
                fallbackCameraBuffer,
                null,
                asElementCount(0),
                null,
                null,
                asElementCount(0),
                null
            );
            return;
        }
        const entitiesReady: WasmBooleanFlag = stageRenderer.areEntitiesReady()
            ? 1
            : 0;
        const resizeStepSeconds: Seconds = asSeconds(0.0001);
        wasmExports.step_scene(resizeStepSeconds, motionScale, entitiesReady);
        drawCurrentWasmViews();
    }

    function synchronizeStageSize(): void {
        if (isStopped) {
            return;
        }
        const didResizeBuffer: boolean = measureStageContainer();
        if (wasmExports) {
            wasmExports.resize_scene(cssWidth, cssHeight);
        }
        if (didResizeBuffer) {
            redrawAfterResize();
        }
    }

    const resizeObserver: ResizeObserver = new ResizeObserver(
        synchronizeStageSize
    );

    let activeStageLinkHref: SafeRelativeHref | "" = "";
    let isMousePointerActive: boolean = false;
    const defaultTargetHref: string =
        stage.getAttribute("data-target-href") ||
        stage.getAttribute("data-portal-href") ||
        "";

    function resolveEntityTargetHref(
        hitEntityIndex: HitEntityResult
    ): SafeRelativeHref | "" {
        if (sceneMode === SCENE_GRID || hitEntityIndex < 0) {
            return "";
        }
        const entityAttribute: string = `data-portal-${hitEntityIndex}-href`;
        const candidateHref: string =
            stage.getAttribute(entityAttribute) || defaultTargetHref;
        const isSafeRelativePath: boolean =
            candidateHref.startsWith("/") && !candidateHref.startsWith("//");
        if (!isSafeRelativePath) {
            return "";
        }
        return candidateHref as SafeRelativeHref;
    }

    function applyStageLinkHref(nextHref: SafeRelativeHref | ""): void {
        if (!stageLink || nextHref === activeStageLinkHref) {
            return;
        }
        activeStageLinkHref = nextHref;
        if (!nextHref) {
            stageLink.classList.remove("stage-link--active");
            stageLink.removeAttribute("href");
            return;
        }
        stageLink.setAttribute("href", nextHref);
        stageLink.classList.add("stage-link--active");
    }

    function synchronizeStageLink(): void {
        if (
            isStopped ||
            !isMousePointerActive ||
            !pendingPointerPosition ||
            !wasmExports ||
            !stageRenderer.areEntitiesReady()
        ) {
            applyStageLinkHref("");
            return;
        }
        const hitEntityIndex: HitEntityResult = wasmExports.click_stage(
            pendingPointerPosition[0],
            pendingPointerPosition[1]
        );
        const resolvedHref: SafeRelativeHref | "" =
            resolveEntityTargetHref(hitEntityIndex);
        applyStageLinkHref(resolvedHref);
    }

    function shutdownToFallback(): void {
        if (isStopped) {
            return;
        }
        isStopped = true;
        cancelAnimationFrame(animationFrameId);
        abortController.abort();
        resizeObserver.disconnect();
        applyStageLinkHref("");
        stageContainer.classList.remove("site-stage--interactive-hover");
        stage.classList.remove("stage--ready");
        stageRenderer.dispose();
    }

    resizeObserver.observe(stageContainer);

    stage.addEventListener(
        "webglcontextlost",
        (contextEvent: Event): void => {
            contextEvent.preventDefault();
            shutdownToFallback();
        },
        { signal: abortSignal }
    );

    let activeTouchPointerId: PointerIdentifier | null = null;
    let touchStartX: CssPixels = asCssPixels(0);
    let touchStartY: CssPixels = asCssPixels(0);
    let previousTouchX: CssPixels = asCssPixels(0);
    let previousTouchY: CssPixels = asCssPixels(0);
    let touchNormalizedX: SignedUnit = clampSignedUnit(0);
    let touchNormalizedY: SignedUnit = clampSignedUnit(0);
    let isTouchDragging: boolean = false;

    function readCurrentCameraNormalized(): NormalizedCameraTuple {
        const neutralOrigin: NormalizedCameraTuple = [
            clampSignedUnit(0),
            clampSignedUnit(0),
        ];
        if (!wasmExports) {
            return neutralOrigin;
        }
        const cameraView: CameraUniformBuffer | null =
            readTypedFloat32Buffer<CameraUniformBuffer>(
                wasmExports.memory,
                wasmExports.get_camera_pointer(),
                CAMERA_FLOATS
            );
        if (!cameraView) {
            return neutralOrigin;
        }
        const safeWidth: number = Math.max(1, cssWidth);
        const safeHeight: number = Math.max(1, cssHeight);
        const aspectRatio: number = safeWidth / safeHeight;
        const narrowness: UnitInterval = clampUnitInterval(
            (1.35 - aspectRatio) / 0.85
        );
        const horizontalPanRange: number = 0.52 + narrowness * 1.78;
        return [
            clampSignedUnit(cameraView[0] / horizontalPanRange),
            clampSignedUnit(-cameraView[1] / 0.2),
        ];
    }

    function handleTouchSwipeMove(pointerEvent: PointerEvent): void {
        const eventPointerId: PointerIdentifier = asPointerIdentifier(
            pointerEvent.pointerId
        );
        if (eventPointerId !== activeTouchPointerId) {
            return;
        }
        const clientX: CssPixels = asCssPixels(pointerEvent.clientX);
        const clientY: CssPixels = asCssPixels(pointerEvent.clientY);
        const containerBounds: DOMRect =
            stageContainer.getBoundingClientRect();
        const stageX: CssPixels = asCssPixels(clientX - containerBounds.left);
        const stageY: CssPixels = asCssPixels(clientY - containerBounds.top);
        const safeWidth: number = Math.max(1, cssWidth);
        const safeHeight: number = Math.max(1, cssHeight);
        const totalDeltaX: number = clientX - touchStartX;
        const totalDeltaY: number = clientY - touchStartY;
        const movedDistanceSquared: number =
            totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY;
        if (!isTouchDragging && movedDistanceSquared < 36) {
            const stationaryCamX: CssPixels = asCssPixels(
                (touchNormalizedX * 0.5 + 0.5) * safeWidth
            );
            const stationaryCamY: CssPixels = asCssPixels(
                (touchNormalizedY * 0.5 + 0.5) * safeHeight
            );
            sendTouchMove(stationaryCamX, stationaryCamY, stageX, stageY);
            return;
        }
        if (!isTouchDragging) {
            isTouchDragging = true;
            previousTouchX = clientX;
            previousTouchY = clientY;
        }
        const stepX: number = ((clientX - previousTouchX) / safeWidth) * 2;
        const stepY: number = ((clientY - previousTouchY) / safeHeight) * 2;
        previousTouchX = clientX;
        previousTouchY = clientY;
        touchNormalizedX = clampSignedUnit(touchNormalizedX + stepX);
        touchNormalizedY = clampSignedUnit(touchNormalizedY + stepY);
        const swipeCamX: CssPixels = asCssPixels(
            (touchNormalizedX * 0.5 + 0.5) * safeWidth
        );
        const swipeCamY: CssPixels = asCssPixels(
            (touchNormalizedY * 0.5 + 0.5) * safeHeight
        );
        sendTouchMove(swipeCamX, swipeCamY, stageX, stageY);
    }

    function sendPointerMove(pointerX: CssPixels, pointerY: CssPixels): void {
        pendingTouchPosition = null;
        pendingPointerPosition = [pointerX, pointerY];
        if (wasmExports) {
            wasmExports.pointer_move(pointerX, pointerY);
        }
    }

    function sendTouchMove(
        cameraX: CssPixels,
        cameraY: CssPixels,
        lightX: CssPixels,
        lightY: CssPixels
    ): void {
        pendingPointerPosition = null;
        pendingTouchPosition = [cameraX, cameraY, lightX, lightY];
        if (wasmExports) {
            wasmExports.touch_move(cameraX, cameraY, lightX, lightY);
        }
    }

    function sendPointerLeave(): void {
        isMousePointerActive = false;
        pendingPointerPosition = null;
        pendingTouchPosition = null;
        applyStageLinkHref("");
        if (wasmExports) {
            wasmExports.pointer_leave();
        }
        stageContainer.classList.remove("site-stage--interactive-hover");
    }

    function endTouchInteraction(pointerId: PointerIdentifier): void {
        if (activeTouchPointerId !== pointerId) {
            return;
        }
        activeTouchPointerId = null;
        isTouchDragging = false;
        if (isStopped) {
            return;
        }
        sendPointerLeave();
    }

    function isDirectStageTarget(eventTarget: EventTarget | null): boolean {
        return (
            eventTarget === stageSurface ||
            eventTarget === stageLink ||
            eventTarget === stageContainer
        );
    }

    stageSurface.addEventListener(
        "touchmove",
        (touchEvent: TouchEvent): void => {
            if (activeTouchPointerId === null || !touchEvent.cancelable) {
                return;
            }
            touchEvent.preventDefault();
        },
        { passive: false, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointerdown",
        (pointerEvent: PointerEvent): void => {
            if (isStopped || pointerEvent.pointerType !== "touch") {
                return;
            }
            if (activeTouchPointerId !== null) {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            const clientX: CssPixels = asCssPixels(pointerEvent.clientX);
            const clientY: CssPixels = asCssPixels(pointerEvent.clientY);
            isMousePointerActive = false;
            applyStageLinkHref("");
            activeTouchPointerId = asPointerIdentifier(pointerEvent.pointerId);
            touchStartX = clientX;
            touchStartY = clientY;
            isTouchDragging = false;
            const containerBounds: DOMRect =
                stageContainer.getBoundingClientRect();
            const stageX: CssPixels = asCssPixels(
                clientX - containerBounds.left
            );
            const stageY: CssPixels = asCssPixels(
                clientY - containerBounds.top
            );
            const safeWidth: number = Math.max(1, cssWidth);
            const safeHeight: number = Math.max(1, cssHeight);
            const currentNormalized: NormalizedCameraTuple =
                readCurrentCameraNormalized();
            touchNormalizedX = currentNormalized[0];
            touchNormalizedY = currentNormalized[1];
            const initialCamX: CssPixels = asCssPixels(
                (touchNormalizedX * 0.5 + 0.5) * safeWidth
            );
            const initialCamY: CssPixels = asCssPixels(
                (touchNormalizedY * 0.5 + 0.5) * safeHeight
            );
            sendTouchMove(initialCamX, initialCamY, stageX, stageY);
            try {
                stageSurface.setPointerCapture(pointerEvent.pointerId);
            } catch {}
        },
        { passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointerdown",
        (pointerEvent: PointerEvent): void => {
            if (isStopped || pointerEvent.pointerType === "touch") {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            if (!isDirectStageTarget(pointerEvent.target)) {
                isMousePointerActive = false;
                applyStageLinkHref("");
                return;
            }
            const containerBounds: DOMRect =
                stageContainer.getBoundingClientRect();
            const stageX: CssPixels = asCssPixels(
                pointerEvent.clientX - containerBounds.left
            );
            const stageY: CssPixels = asCssPixels(
                pointerEvent.clientY - containerBounds.top
            );
            isMousePointerActive = true;
            sendPointerMove(stageX, stageY);
            synchronizeStageLink();
        },
        { capture: true, passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointermove",
        (pointerEvent: PointerEvent): void => {
            if (isStopped) {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            if (pointerEvent.pointerType === "touch") {
                handleTouchSwipeMove(pointerEvent);
                return;
            }
            const containerBounds: DOMRect =
                stageContainer.getBoundingClientRect();
            const stageX: CssPixels = asCssPixels(
                pointerEvent.clientX - containerBounds.left
            );
            const stageY: CssPixels = asCssPixels(
                pointerEvent.clientY - containerBounds.top
            );
            sendPointerMove(stageX, stageY);
            isMousePointerActive = isDirectStageTarget(pointerEvent.target);
            synchronizeStageLink();
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointerup",
        (pointerEvent: PointerEvent): void => {
            if (pointerEvent.pointerType !== "touch") {
                return;
            }
            endTouchInteraction(asPointerIdentifier(pointerEvent.pointerId));
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointercancel",
        (pointerEvent: PointerEvent): void => {
            if (pointerEvent.pointerType !== "touch") {
                return;
            }
            endTouchInteraction(asPointerIdentifier(pointerEvent.pointerId));
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "lostpointercapture",
        (pointerEvent: PointerEvent): void => {
            endTouchInteraction(asPointerIdentifier(pointerEvent.pointerId));
        },
        { passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointerleave",
        (pointerEvent: PointerEvent): void => {
            if (isStopped || pointerEvent.pointerType === "touch") {
                return;
            }
            sendPointerLeave();
        },
        { passive: true, signal: abortSignal }
    );

    function registerStageClickNavigation(): void {
        if (sceneMode === SCENE_GRID) {
            return;
        }
        stageContainer.addEventListener(
            "click",
            (clickEvent: MouseEvent): void => {
                if (
                    isStopped ||
                    !wasmExports ||
                    clickEvent.button !== 0 ||
                    clickEvent.target === stageLink
                ) {
                    return;
                }
                if (!isDirectStageTarget(clickEvent.target)) {
                    return;
                }
                const validClientX: boolean = Number.isFinite(
                    clickEvent.clientX
                );
                const validClientY: boolean = Number.isFinite(
                    clickEvent.clientY
                );
                if (!validClientX || !validClientY) {
                    return;
                }
                const containerBounds: DOMRect =
                    stageContainer.getBoundingClientRect();
                const stageX: CssPixels = asCssPixels(
                    clickEvent.clientX - containerBounds.left
                );
                const stageY: CssPixels = asCssPixels(
                    clickEvent.clientY - containerBounds.top
                );
                const hitEntityIndex: HitEntityResult =
                    wasmExports.click_stage(stageX, stageY);
                const targetHref: SafeRelativeHref | "" =
                    resolveEntityTargetHref(hitEntityIndex);
                if (!targetHref) {
                    return;
                }
                window.location.assign(targetHref);
            },
            { passive: true, signal: abortSignal }
        );
    }

    registerStageClickNavigation();

    function renderFallbackGridFrame(deltaSeconds: Seconds): void {
        fallbackCameraBuffer[7] =
            (fallbackCameraBuffer[7] + deltaSeconds * 0.85 * motionScale) %
            MAJOR_GRID_STEP;
        const renderedGrid: boolean = stageRenderer.render(
            cssWidth,
            cssHeight,
            devicePixelRatio,
            fallbackCameraBuffer,
            null,
            asElementCount(0),
            null,
            null,
            asElementCount(0),
            null
        );
        if (!renderedGrid) {
            shutdownToFallback();
            return;
        }
        scheduleAnimationFrame();
    }

    function renderAnimationFrame(rawTimestamp: DOMHighResTimeStamp): void {
        if (isStopped) {
            return;
        }
        try {
            const safeTimestamp: Milliseconds = asMilliseconds(
                Number.isFinite(rawTimestamp)
                    ? rawTimestamp
                    : previousTimestamp + 16
            );
            const elapsedSeconds: number =
                (safeTimestamp - previousTimestamp) / 1000;
            const deltaSeconds: Seconds = asSeconds(
                Math.min(0.1, Math.max(0.0005, elapsedSeconds))
            );
            previousTimestamp = safeTimestamp;

            stageRenderer.pollAsynchronousJobs();
            const scaledSkyboxStep: Seconds = asSeconds(
                deltaSeconds * motionScale
            );
            stageRenderer.stepSkybox(scaledSkyboxStep);

            if (!wasmExports) {
                renderFallbackGridFrame(deltaSeconds);
                return;
            }

            const entitiesReady: WasmBooleanFlag =
                stageRenderer.areEntitiesReady() ? 1 : 0;
            const qualityTier: QualityTier = wasmExports.step_scene(
                deltaSeconds,
                motionScale,
                entitiesReady
            );
            if (qualityTier >= 2) {
                shutdownToFallback();
                return;
            }
            if (qualityTier >= 1) {
                stageRenderer.setSkyboxAllowed(false);
            }
            if (qualityTier >= 1 && maximumDevicePixelRatio > 1) {
                maximumDevicePixelRatio = asDevicePixelRatio(1);
                measureStageContainer();
                wasmExports.resize_scene(cssWidth, cssHeight);
            }

            if (sceneMode !== SCENE_GRID) {
                const isHovered: boolean =
                    wasmExports.is_interactive_hovered() !== 0;
                stageContainer.classList.toggle(
                    "site-stage--interactive-hover",
                    isHovered
                );
                synchronizeStageLink();
            }

            const renderedFrame: boolean = drawCurrentWasmViews();
            if (!renderedFrame) {
                shutdownToFallback();
                return;
            }

            scheduleAnimationFrame();
        } catch {
            shutdownToFallback();
        }
    }

    document.addEventListener(
        "visibilitychange",
        (): void => {
            if (isStopped) {
                return;
            }
            if (document.hidden) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
            previousTimestamp = asMilliseconds(performance.now());
            scheduleAnimationFrame();
        },
        { passive: true, signal: abortSignal }
    );

    window.addEventListener(
        "pageshow",
        (): void => {
            if (isStopped || document.hidden) {
                return;
            }
            previousTimestamp = asMilliseconds(performance.now());
            scheduleAnimationFrame();
        },
        { passive: true, signal: abortSignal }
    );

    scheduleAnimationFrame();
}

initializeStage();
