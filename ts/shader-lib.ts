const { Math, Uint32Array } = globalThis;

declare const BRAND_SYMBOL: unique symbol;

export type Branded<BaseType, BrandName extends string> = BaseType & {
    readonly [BRAND_SYMBOL]: BrandName;
};

export type CssPixels = Branded<number, "CssPixels">;
export type DevicePixels = Branded<number, "DevicePixels">;
export type DevicePixelRatio = Branded<number, "DevicePixelRatio">;
export type CanvasDesignUnits = Branded<number, "CanvasDesignUnits">;
export type Seconds = Branded<number, "Seconds">;
export type Milliseconds = Branded<number, "Milliseconds">;
export type Radians = Branded<number, "Radians">;
export type Millimeters = Branded<number, "Millimeters">;
export type WorldUnits = Branded<number, "WorldUnits">;
export type UnitInterval = Branded<number, "UnitInterval">;
export type SignedUnit = Branded<number, "SignedUnit">;
export type WasmByteOffset = Branded<number, "WasmByteOffset">;
export type ElementCount = Branded<number, "ElementCount">;
export type RandomSeed = Branded<number, "RandomSeed">;
export type SkyboxGeneration = Branded<number, "SkyboxGeneration">;
export type GlslSource = Branded<string, "GlslSource">;
export type GlslSnippet = Branded<string, "GlslSnippet">;
export type SafeRelativeHref = Branded<string, "SafeRelativeHref">;

export type QualityTier = 0 | 1 | 2;
export type WasmBooleanFlag = 0 | 1;

export type DarkSkyboxId = "dark-nebula" | "dark-aurora" | "dark-twilight";
export type LightSkyboxId = "light-cirrus" | "light-dawn" | "light-mist";
export type ThemeSkyboxId = DarkSkyboxId | LightSkyboxId;
export type CustomSkyboxId = Branded<string, "CustomSkyboxId">;
export type SkyboxId = ThemeSkyboxId | CustomSkyboxId;

export type CameraUniformBuffer = Branded<Float32Array, "CameraUniformBuffer">;
export type KeypadUniformBuffer = Branded<Float32Array, "KeypadUniformBuffer">;
export type PortalsUniformBuffer = Branded<
    Float32Array,
    "PortalsUniformBuffer"
>;
export type PortalRingsBuffer = Branded<Float32Array, "PortalRingsBuffer">;
export type ParticlesInstanceBuffer = Branded<
    Float32Array,
    "ParticlesInstanceBuffer"
>;
export type SkySeedVector = Branded<Float32Array, "SkySeedVector">;
export type PortalMetadataBuffer = Branded<
    Uint32Array,
    "PortalMetadataBuffer"
>;

export type QuadBoundsTuple = readonly [
    CssPixels,
    CssPixels,
    CssPixels,
    CssPixels,
];

export type CameraSpaceTuple = readonly [WorldUnits, WorldUnits, WorldUnits];

export interface SkyboxShaderModule {
    readonly SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource;
}

export function asCssPixels(rawPixels: number): CssPixels {
    return rawPixels as CssPixels;
}

export function asDevicePixels(rawPixels: number): DevicePixels {
    return rawPixels as DevicePixels;
}

export function asDevicePixelRatio(rawRatio: number): DevicePixelRatio {
    return rawRatio as DevicePixelRatio;
}

export function asDesignUnits(rawUnits: number): CanvasDesignUnits {
    return rawUnits as CanvasDesignUnits;
}

export function asSeconds(rawSeconds: number): Seconds {
    return rawSeconds as Seconds;
}

export function asMilliseconds(rawMilliseconds: number): Milliseconds {
    return rawMilliseconds as Milliseconds;
}

export function asRadians(rawRadians: number): Radians {
    return rawRadians as Radians;
}

export function asMillimeters(rawMillimeters: number): Millimeters {
    return rawMillimeters as Millimeters;
}

export function asWorldUnits(rawUnits: number): WorldUnits {
    return rawUnits as WorldUnits;
}

export function asElementCount(rawCount: number): ElementCount {
    return rawCount as ElementCount;
}

export function clampUnitInterval(rawValue: number): UnitInterval {
    const clamped: number = Math.min(1.0, Math.max(0.0, rawValue));
    return clamped as UnitInterval;
}

export function clampSignedUnit(rawValue: number): SignedUnit {
    const clamped: number = Math.min(1.0, Math.max(-1.0, rawValue));
    return clamped as SignedUnit;
}

export function asGlslSource(sourceText: string): GlslSource {
    return sourceText as GlslSource;
}

export function asGlslSnippet(snippetText: string): GlslSnippet {
    return snippetText as GlslSnippet;
}

export const CAMERA_FLOATS: ElementCount = asElementCount(20);
export const KEYPAD_FLOATS: ElementCount = asElementCount(16);
export const MAXIMUM_PORTALS: ElementCount = asElementCount(4);
export const PORTAL_FLOATS: ElementCount = asElementCount(12);
export const RING_FLOATS_PER_PORTAL: ElementCount = asElementCount(8);
export const PARTICLE_FLOATS: ElementCount = asElementCount(8);
export const METADATA_U32S_PER_PORTAL: ElementCount = asElementCount(4);
export const MAJOR_GRID_STEP: WorldUnits = asWorldUnits(4.0);

function readRandomCryptoSeed(): number {
    if (!globalThis.crypto?.getRandomValues) {
        return 0;
    }
    const seedBuffer: Uint32Array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(seedBuffer);
    const seedValue: number = seedBuffer[0];
    return seedValue;
}

export function generateRandomSeed(): RandomSeed {
    const cryptoSeed: number = readRandomCryptoSeed();
    if (cryptoSeed !== 0) {
        return cryptoSeed as RandomSeed;
    }
    const timestampBits: number =
        (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    const fallbackSeed: number = timestampBits || 1;
    return fallbackSeed as RandomSeed;
}

export function createSkySeedVector(): SkySeedVector {
    const rawBuffer: Float32Array = new Float32Array(4);
    return populateSkySeedVector(rawBuffer as SkySeedVector);
}

export function populateSkySeedVector(
    targetVector: SkySeedVector
): SkySeedVector {
    const seedA: RandomSeed = generateRandomSeed();
    const seedB: RandomSeed = generateRandomSeed();
    const unitX: number = (seedA >>> 8) / 16777216.0;
    const unitY: number = (seedB >>> 8) / 16777216.0;
    const angleWord: number = ((seedA & 0xff) << 8) | (seedB & 0xff);
    const azimuthRadians: Radians = asRadians(
        angleWord * ((Math.PI * 2.0) / 65536.0)
    );
    targetVector[0] = (unitX - 0.5) * 320.0;
    targetVector[1] = (unitY - 0.5) * 320.0;
    targetVector[2] = Math.cos(azimuthRadians);
    targetVector[3] = Math.sin(azimuthRadians);
    return targetVector;
}

export function projectPointToCameraSpace(
    worldX: WorldUnits,
    worldY: WorldUnits,
    worldZ: WorldUnits,
    cameraBuffer: CameraUniformBuffer
): CameraSpaceTuple {
    const offsetX: number = worldX - cameraBuffer[0];
    const offsetY: number = worldY - cameraBuffer[1];
    const offsetZ: number = worldZ - cameraBuffer[2];
    const cameraSpaceX: WorldUnits = asWorldUnits(
        offsetX * cameraBuffer[8]
        + offsetY * cameraBuffer[9]
        + offsetZ * cameraBuffer[10]
    );
    const cameraSpaceY: WorldUnits = asWorldUnits(
        offsetX * cameraBuffer[12]
        + offsetY * cameraBuffer[13]
        + offsetZ * cameraBuffer[14]
    );
    const cameraSpaceZ: WorldUnits = asWorldUnits(
        Math.max(
            1.0,
            offsetX * cameraBuffer[4]
            + offsetY * cameraBuffer[5]
            + offsetZ * cameraBuffer[6]
        )
    );
    return [cameraSpaceX, cameraSpaceY, cameraSpaceZ];
}

export const FULLSCREEN_TRIANGLE_VERTEX_SHADER: GlslSource = asGlslSource(
    `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`
);

export const BOUNDED_QUAD_VERTEX_SHADER: GlslSource = asGlslSource(
    `#version 300 es
in vec2 a_quad;

uniform vec2 u_resolution;
uniform vec4 u_bounds_rect;

out vec2 v_quad_uv;

void main() {
    vec2 pixelPosition = u_bounds_rect.xy + a_quad * u_bounds_rect.zw;
    float clipSpaceX =
        (pixelPosition.x / max(u_resolution.x, 1.0)) * 2.0 - 1.0;
    float clipSpaceY =
        1.0 - (pixelPosition.y / max(u_resolution.y, 1.0)) * 2.0;
    gl_Position = vec4(clipSpaceX, clipSpaceY, 0.0, 1.0);
    v_quad_uv = a_quad * 0.5 + 0.5;
}
`
);

export const GLSL_CAMERA_RAY_LIB: GlslSnippet = asGlslSnippet(`
vec2 computeStagePixelPosition(vec2 resolution, float devicePixelRatio) {
    return vec2(
        gl_FragCoord.x / devicePixelRatio,
        resolution.y - gl_FragCoord.y / devicePixelRatio
    );
}

vec3 computeStageRayDirection(
    vec2 pixelPosition,
    vec2 resolution,
    vec4 camera[5]
) {
    float halfHeight = max(resolution.y * 0.5, 1.0);
    float horizontalTangent =
        ((pixelPosition.x - resolution.x * 0.5) / halfHeight) * camera[0].w;
    float verticalTangent =
        ((resolution.y * 0.5 - pixelPosition.y) / halfHeight) * camera[0].w;
    return normalize(
        camera[1].xyz
        + horizontalTangent * camera[2].xyz
        + verticalTangent * camera[3].xyz
    );
}
`);

export const GLSL_NOISE_LIB: GlslSnippet = asGlslSnippet(`
float hashCell(vec2 cellId) {
    vec2 hashed = fract(cellId * vec2(0.1031, 0.1030));
    hashed += dot(hashed, hashed.yx + 33.33);
    return fract((hashed.x + hashed.y) * hashed.x);
}

vec2 hashCell2(vec2 cellId) {
    vec3 hashed = fract(vec3(cellId.xyx) * vec3(0.1031, 0.1030, 0.0973));
    hashed += dot(hashed, hashed.yzx + 33.33);
    return fract((hashed.xx + hashed.yz) * hashed.zy);
}

float valueNoiseSimd(vec2 position) {
    vec2 cellIndex = floor(position);
    vec2 cellFraction = fract(position);
    vec2 smoothUv = cellFraction * cellFraction * (3.0 - 2.0 * cellFraction);
    vec4 cornerX = fract((cellIndex.x + vec4(0.0, 1.0, 0.0, 1.0)) * 123.34);
    vec4 cornerY = fract((cellIndex.y + vec4(0.0, 0.0, 1.0, 1.0)) * 456.21);
    vec4 dotTerm = cornerX * (cornerX + 45.32) + cornerY * (cornerY + 45.32);
    vec4 hashes = fract((cornerX + dotTerm) * (cornerY + dotTerm));
    vec2 mixX = mix(hashes.xz, hashes.yw, smoothUv.x);
    return mix(mixX.x, mixX.y, smoothUv.y);
}

vec3 evaluateFbmOctaves3(
    vec2 baseUv,
    mat2 octaveRotation,
    vec2 stepOffsetA,
    vec2 stepOffsetB
) {
    float layer0 = valueNoiseSimd(baseUv);
    vec2 uv1 = octaveRotation * baseUv * 2.08 + stepOffsetA;
    float layer1 = valueNoiseSimd(uv1);
    vec2 uv2 = octaveRotation * uv1 * 2.05 + stepOffsetB;
    float layer2 = valueNoiseSimd(uv2);
    return vec3(layer0, layer1, layer2);
}
`);

export const GLSL_PORTAL_RINGS_LIB: GlslSnippet = asGlslSnippet(`
float evaluatePortalRings(float radialDistance, vec4 radii, vec4 alphas) {
    vec4 radialDelta = radialDistance - radii;
    vec4 squaredDelta = radialDelta * radialDelta;
    vec4 ringProfile =
        exp(-squaredDelta * 34.0) + exp(-squaredDelta * 5.5) * 0.45;
    return dot(ringProfile, alphas);
}
`);

export const GLSL_STARFIELD_LIB: GlslSnippet = asGlslSnippet(`
float evaluateSphericalStars(
    vec3 rayDir,
    vec4 skySeed,
    float densityScale,
    float threshold,
    float sharpness,
    float twinkleSpeed,
    float timeSeconds,
    vec2 layerShift
) {
    float horizonFade = smoothstep(0.015, 0.12, rayDir.y);
    if (horizonFade <= 0.001) {
        return 0.0;
    }
    mat2 skyRotation = mat2(skySeed.z, -skySeed.w, skySeed.w, skySeed.z);
    vec2 rotatedXz = skyRotation * rayDir.xz;
    float conformalDivisor = 1.0 + max(rayDir.y, -0.25);
    vec2 stereoUv = rotatedXz / conformalDivisor
        + skySeed.xy * 0.17
        + layerShift;
    vec2 scaled = stereoUv * densityScale;
    vec2 cellId = floor(scaled);
    vec2 localUv = fract(scaled) - 0.5;
    float seed = hashCell(cellId);
    if (seed < threshold) {
        return 0.0;
    }
    vec2 jitter = hashCell2(cellId + vec2(17.0, 29.0));
    vec2 starOffset = (jitter - 0.5) * 0.52;
    vec2 conformalDelta = (localUv - starOffset) * conformalDivisor;
    float distSq = dot(conformalDelta, conformalDelta);
    float twinkle =
        0.74 + 0.26 * sin(timeSeconds * twinkleSpeed + seed * 37.0);
    float magnitude = smoothstep(threshold, 0.996, seed);
    return exp(-distSq * sharpness) * twinkle * magnitude * horizonFade;
}
`);

export function buildSkyboxFragmentShader(
    skyboxMainBody: GlslSnippet
): GlslSource {
    const fullSource: string = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform vec4 u_camera[5];
uniform float u_time;
uniform vec4 u_sky_seed;

out vec4 outColor;
${GLSL_CAMERA_RAY_LIB}${GLSL_NOISE_LIB}${GLSL_STARFIELD_LIB}
void main() {
    vec2 pixelPos = computeStagePixelPosition(
        u_resolution,
        u_device_pixel_ratio
    );
    vec3 rayDir = computeStageRayDirection(pixelPos, u_resolution, u_camera);
    float elevation = clamp(rayDir.y, -0.15, 1.0);
    mat2 seedRotation =
        mat2(u_sky_seed.z, -u_sky_seed.w, u_sky_seed.w, u_sky_seed.z);
    vec2 rotatedXz = seedRotation * rayDir.xz;
    vec2 seededDomeUv =
        rotatedXz / (max(elevation, 0.0) + 0.38) + u_sky_seed.xy;
    float sunAzimuthShift = u_sky_seed.z * 0.46;
${skyboxMainBody}
}
`;
    return asGlslSource(fullSource);
}
