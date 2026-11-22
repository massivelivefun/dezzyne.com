import {
    GLSL_CAMERA_RAY_LIB,
    GLSL_NOISE_LIB,
    GLSL_PORTAL_RINGS_LIB,
    METADATA_U32S_PER_PORTAL,
    PARTICLE_FLOATS,
    asDesignUnits,
    asDevicePixels,
    asGlslSource,
    type Branded,
    type CanvasDesignUnits,
    type DevicePixels,
    type ElementCount,
    type GlslSource,
    type PortalMetadataBuffer,
} from "./shader-lib.ts";

const { Math, String } = globalThis;

export { METADATA_U32S_PER_PORTAL, PARTICLE_FLOATS };

type CssColorValue = Branded<string, "CssColorValue">;
type CssFontSpec = Branded<string, "CssFontSpec">;

function asCssColor(rawColor: string): CssColorValue {
    return rawColor as CssColorValue;
}

function asCssFont(rawFont: string): CssFontSpec {
    return rawFont as CssFontSpec;
}

export interface LabelSlot {
    readonly texture: WebGLTexture;
    previousSeconds: number;
    previousIdentifier: number;
    isReady: boolean;
}

export interface LabelManager {
    readonly aspectRatio: number;
    readonly slots: readonly LabelSlot[];
    setLightMode(nextLightMode: boolean): void;
    synchronize(
        portalCount: ElementCount,
        metadataView: PortalMetadataBuffer
    ): void;
    dispose(): void;
}

export interface PortalsShaderModule {
    readonly METADATA_U32S_PER_PORTAL: ElementCount;
    readonly PARTICLE_FLOATS: ElementCount;
    readonly PORTAL_FRAGMENT_SHADER_SOURCE: GlslSource;
    readonly PARTICLE_VERTEX_SHADER_SOURCE: GlslSource;
    readonly PARTICLE_FRAGMENT_SHADER_SOURCE: GlslSource;
    readonly LABEL_FRAGMENT_SHADER_SOURCE: GlslSource;
    createLabelManager(
        glContext: WebGL2RenderingContext,
        initialLightMode?: boolean
    ): LabelManager | null;
}

const DESIGN_WIDTH: CanvasDesignUnits = asDesignUnits(920);
const DESIGN_HEIGHT: CanvasDesignUnits = asDesignUnits(428);
const LABEL_TEXTURE_WIDTH: DevicePixels = asDevicePixels(640);
const LABEL_TEXTURE_HEIGHT: DevicePixels = asDevicePixels(298);
const LABEL_RENDER_SCALE: number = LABEL_TEXTURE_WIDTH / DESIGN_WIDTH;
const LABEL_ASPECT_RATIO: number = DESIGN_WIDTH / DESIGN_HEIGHT;
const LABEL_FONT_FAMILY: string =
    '"Helvetica Neue", Helvetica, "Inter", sans-serif';

const LABEL_TEXT_COLOR: CssColorValue = asCssColor("#f5f7fa");
const LABEL_RIM_SHADOW_COLOR: CssColorValue = asCssColor(
    "rgba(0, 0, 0, 0.85)"
);
const LABEL_DROP_SHADOW_COLOR: CssColorValue = asCssColor(
    "rgba(0, 0, 0, 0.45)"
);
const SHADOW_BACKING_FILL: CssColorValue = asCssColor("#000000");
const OFFSCREEN_DESIGN_SHIFT: number = DESIGN_WIDTH * 2;
const OFFSCREEN_PIXEL_SHIFT: number = LABEL_TEXTURE_WIDTH * 2;
const FLAG_CRIMSON_COLOR: CssColorValue = asCssColor("#d92b3a");
const FLAG_WHITE_COLOR: CssColorValue = asCssColor("#f4f6f9");
const FLAG_CANTON_COLOR: CssColorValue = asCssColor("#1c4ca8");
const PURE_WHITE_COLOR: CssColorValue = asCssColor("#ffffff");
const FLAG_RING_STROKE: CssColorValue = asCssColor(
    "rgba(255, 255, 255, 0.85)"
);
const DARK_BADGE_DISC_FILL: CssColorValue = asCssColor(
    "rgba(14, 18, 26, 0.54)"
);
const LIGHT_BADGE_DISC_FILL: CssColorValue = asCssColor(
    "rgba(14, 18, 26, 0.86)"
);
const WINDOWS_ACCENT_COLOR: CssColorValue = asCssColor("#00a8ff");
const ANDROID_ACCENT_COLOR: CssColorValue = asCssColor("#2ed57a");
const ANDROID_EYE_COLOR: CssColorValue = asCssColor("#121822");
const APPLE_ACCENT_COLOR: CssColorValue = asCssColor("#e8eaf2");

const TITLE_FONT_SPEC: CssFontSpec = asCssFont(
    `500 42px ${LABEL_FONT_FAMILY}`
);
const SUBTITLE_FONT_SPEC: CssFontSpec = asCssFont(
    `400 34px ${LABEL_FONT_FAMILY}`
);
const METADATA_FONT_SPEC: CssFontSpec = asCssFont(
    `400 32px ${LABEL_FONT_FAMILY}`
);
const COUNTDOWN_FONT_SPEC: CssFontSpec = asCssFont(
    `700 42px ${LABEL_FONT_FAMILY}`
);

export const PORTAL_FRAGMENT_SHADER_SOURCE: GlslSource = asGlslSource(
    `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform int u_zero;
uniform vec4 u_camera[5];
uniform vec4 u_portal[3];
uniform vec4 u_portal_rings[2];
uniform float u_phase_offset;
uniform float u_light_mode;

out vec4 outColor;
${GLSL_CAMERA_RAY_LIB}${GLSL_NOISE_LIB}${GLSL_PORTAL_RINGS_LIB}
void main() {
    vec2 pixelPosition =
        computeStagePixelPosition(u_resolution, u_device_pixel_ratio);

    vec2 portalRadii = max(u_portal[0].zw, vec2(1.0));
    vec2 normalizedOffset = (pixelPosition - u_portal[0].xy) / portalRadii;
    float normalizedRadius = length(normalizedOffset);
    if (normalizedRadius >= 1.36 || u_portal[0].z <= 2.0) {
        discard;
    }

    float popAlpha = clamp(u_portal[2].y, 0.0, 1.0);
    float auraDistance = max(normalizedRadius - 0.98, 0.0);
    float auraFade = smoothstep(1.36, 1.0, normalizedRadius);
    float auraIntensity = exp(-auraDistance * 8.5) * auraFade;
    float auraStrength = auraIntensity * 0.52 * popAlpha;
    vec3 auraBlue = vec3(0.16, 0.54, 1.00);
    vec3 auraColor = auraBlue * auraStrength;
    float auraAlpha = clamp(auraStrength * 1.05, 0.0, 0.72) * u_light_mode;

    if (normalizedRadius > 1.04) {
        outColor = vec4(auraColor, auraAlpha);
        return;
    }

    float pixelScale = min(portalRadii.x, portalRadii.y);
    float animationTime = u_portal[2].x + u_phase_offset;
    float edgeDistancePixels = (normalizedRadius - 1.0) * pixelScale;
    float portalMask =
        (1.0 - smoothstep(-1.2, 1.2, edgeDistancePixels)) * popAlpha;

    float polarAngle = atan(normalizedOffset.y, normalizedOffset.x);
    float inwardPull = pow(1.0 - clamp(normalizedRadius, 0.0, 1.0), 1.35);
    float swirlAngle = polarAngle - 3.6 * inwardPull + animationTime * 1.35;
    vec2 swirlDirection = vec2(cos(swirlAngle), sin(swirlAngle));
    vec2 swirlCoords = swirlDirection * (normalizedRadius * 2.4 + 0.22);

    float primaryNoise = 0.0;
    float warpedNoise = 0.0;
    mat2 octaveRotation = mat2(0.8, -0.6, 0.6, 0.8);
    for (int fbmPass = u_zero; fbmPass < 2; fbmPass++) {
        vec2 noiseCoords = (fbmPass == 0)
            ? (swirlCoords * 1.65 - vec2(
                animationTime * 0.34,
                animationTime * 0.22
            ))
            : (swirlCoords * 2.95 + vec2(
                primaryNoise * 1.45 + animationTime * 0.42,
                -primaryNoise * 1.25
            ));
        float octaveSum = 0.0;
        float amplitude = 0.5;
        for (int octaveIndex = u_zero; octaveIndex < 4; octaveIndex++) {
            octaveSum += amplitude * valueNoiseSimd(noiseCoords);
            noiseCoords = octaveRotation * noiseCoords * 2.03 + vec2(1.7, 9.2);
            amplitude *= 0.5;
        }
        primaryNoise = (fbmPass == 0) ? octaveSum : primaryNoise;
        warpedNoise = (fbmPass == 0) ? warpedNoise : octaveSum;
    }

    float spiralWave = sin(
        swirlAngle * 2.0 + primaryNoise * 4.0 - normalizedRadius * 4.6
    );
    float spiralArms = 0.5 + 0.5 * spiralWave;
    float cyanWisps = pow(1.0 - abs(warpedNoise * 2.0 - 1.0), 2.8);

    vec3 deepVoidColor = vec3(0.06, 0.04, 0.20);
    vec3 violetColor = vec3(0.45, 0.16, 0.84);
    vec3 vrchatBlueColor = vec3(0.10, 0.48, 0.98);
    vec3 cyanWispColor = vec3(0.50, 0.85, 1.00);

    float noiseBlend = smoothstep(0.16, 0.84, primaryNoise);
    vec3 vortexColor = mix(deepVoidColor, violetColor, noiseBlend);
    vortexColor = mix(
        vortexColor,
        vrchatBlueColor,
        spiralArms * (0.54 + 0.36 * normalizedRadius)
    );
    vortexColor +=
        cyanWispColor * cyanWisps * (0.36 + 0.26 * normalizedRadius);
    vortexColor *= 0.56 + 0.44 * smoothstep(0.0, 0.36, normalizedRadius);

    float innerRimFactor = smoothstep(0.68, 0.99, normalizedRadius);
    vec3 innerRimBlue = vec3(0.24, 0.66, 1.00);
    vortexColor = mix(vortexColor, innerRimBlue, innerRimFactor * 0.62);

    float shimmerPhase =
        polarAngle * 3.0 - animationTime * 2.8 + primaryNoise * 3.0;
    float rimShimmer = 0.88 + 0.12 * sin(shimmerPhase);
    float rimMask = 1.0 - smoothstep(-1.2, 1.2, edgeDistancePixels);
    float rimLine = exp(-abs(edgeDistancePixels + 1.5) * 0.62) * rimMask;
    vec3 rimHighlightBlue = vec3(0.54, 0.86, 1.00);
    vec3 rimColor = rimHighlightBlue * rimShimmer;

    vec3 rayDirection =
        computeStageRayDirection(pixelPosition, u_resolution, u_camera);
    float ringIntersectionDistance =
        (u_portal[1].w - u_camera[0].y) / min(rayDirection.y, -0.006);
    vec2 ringPlaneXz =
        u_camera[0].xz + rayDirection.xz * ringIntersectionDistance;
    float portalScale = max(u_portal[2].z, 0.1);
    float ringRadialDistance =
        length(ringPlaneXz - u_portal[1].xy) / portalScale;
    vec4 ringPair0 = u_portal_rings[0];
    vec4 ringPair1 = u_portal_rings[1];
    vec4 ringRadii = vec4(ringPair0.xz, ringPair1.xz) / portalScale;
    vec4 rawAlphas = vec4(ringPair0.yw, ringPair1.yw);
    vec4 ringAlphas = step(vec4(0.001), rawAlphas) * rawAlphas;
    float ringSum =
        evaluatePortalRings(ringRadialDistance, ringRadii, ringAlphas);
    float ringVisibility = smoothstep(-0.008, -0.028, rayDirection.y);
    vec3 ringWaveBlue = vec3(0.18, 0.60, 1.00);
    vec3 ringGlow = ringWaveBlue * min(ringSum, 2.2) * ringVisibility * 0.92;
    float foregroundRingMask = smoothstep(
        u_portal[1].y + 0.04,
        u_portal[1].y - 0.04,
        ringPlaneXz.y
    );

    vec3 premultipliedColor = auraColor * (1.0 - portalMask)
        + vortexColor * portalMask
        + rimColor * rimLine * 0.76 * popAlpha
        + ringGlow * foregroundRingMask * portalMask;
    float fringeAlpha = clamp(
        auraStrength * 1.05 + rimLine * 0.55 * popAlpha,
        0.0,
        0.76
    ) * u_light_mode;
    float compositeAlpha = portalMask + fringeAlpha * (1.0 - portalMask);

    outColor = vec4(premultipliedColor, compositeAlpha);
}
`
);

export const PARTICLE_VERTEX_SHADER_SOURCE: GlslSource = asGlslSource(
    `#version 300 es
in vec2 a_quad;
in vec4 a_particle_geometry;
in vec4 a_particle_appearance;

uniform vec2 u_resolution;

out vec2 v_quad_uv;
out float v_alpha;
out float v_tint_code;

void main() {
    vec2 direction = a_particle_geometry.zw;
    vec2 perpendicular = vec2(-direction.y, direction.x);
    float lengthAlong = a_particle_appearance.x * a_particle_appearance.y;
    float widthAcross = a_particle_appearance.x;
    vec2 pixelOffset = direction * (a_quad.x * lengthAlong)
        + perpendicular * (a_quad.y * widthAcross);
    vec2 pixelPosition = a_particle_geometry.xy + pixelOffset;

    float clipSpaceX =
        (pixelPosition.x / max(u_resolution.x, 1.0)) * 2.0 - 1.0;
    float clipSpaceY =
        1.0 - (pixelPosition.y / max(u_resolution.y, 1.0)) * 2.0;
    gl_Position = vec4(clipSpaceX, clipSpaceY, 0.0, 1.0);

    v_quad_uv = a_quad;
    v_alpha = a_particle_appearance.z;
    v_tint_code = a_particle_appearance.w;
}
`
);

export const PARTICLE_FRAGMENT_SHADER_SOURCE: GlslSource = asGlslSource(
    `#version 300 es
precision highp float;

uniform float u_light_mode;

in vec2 v_quad_uv;
in float v_alpha;
in float v_tint_code;

out vec4 outColor;

void main() {
    float radiusSquared = dot(v_quad_uv, v_quad_uv);
    if (v_tint_code < 0.5 && radiusSquared > 1.0) {
        discard;
    }
    float emissiveGain = mix(1.0, 0.90, u_light_mode);
    if (v_tint_code < 0.5) {
        float moteCore = exp(-radiusSquared * 6.8);
        float moteHalo = exp(-radiusSquared * 2.2) * (1.0 - radiusSquared);
        float moteGlow = moteCore * 0.82 + moteHalo * 0.58;

        float colorBlend = clamp(v_tint_code * 2.2, 0.0, 1.0);
        vec3 deepBlue = vec3(0.20, 0.64, 1.00);
        vec3 skyBlue = vec3(0.38, 0.80, 1.00);
        vec3 moteCoreWhite = vec3(0.86, 0.96, 1.00);
        vec3 baseColor = mix(deepBlue, skyBlue, colorBlend);
        vec3 moteColor = baseColor + moteCoreWhite * moteCore * 0.50;
        vec3 moteRgb = moteColor * moteGlow * v_alpha * emissiveGain;
        float moteAlpha =
            clamp(moteGlow * v_alpha * 0.62, 0.0, 0.76) * u_light_mode;
        outColor = vec4(moteRgb, moteAlpha);
        return;
    }

    float normalizedX = clamp((v_quad_uv.x + 1.0) / 1.60, 0.0, 1.0);
    float noseFade = 1.0 - smoothstep(0.58, 1.0, v_quad_uv.x);
    float tailProfile = pow(normalizedX, 1.70) * noseFade;

    float halfWidth = mix(0.28, 0.92, normalizedX);
    float normalizedY = v_quad_uv.y / max(halfWidth, 0.1);
    float verticalEdge = 1.0 - smoothstep(0.75, 1.0, abs(v_quad_uv.y));
    float streakBody =
        exp(-normalizedY * normalizedY * 3.8) * verticalEdge * tailProfile;

    vec2 headOffset = vec2((v_quad_uv.x - 0.56) * 2.5, v_quad_uv.y * 1.15);
    float streakHead = exp(-dot(headOffset, headOffset) * 5.8);
    float streakGlow = streakBody * 0.88 + streakHead * 0.68;
    if (streakGlow <= 0.002) {
        discard;
    }

    float shadeFactor = clamp(v_tint_code - 1.0, 0.0, 1.0);
    vec3 deepTailViolet = vec3(0.54, 0.20, 0.96);
    vec3 brightTailOrchid = vec3(0.72, 0.26, 0.94);
    vec3 warmHeadRose = vec3(0.94, 0.38, 0.86);
    vec3 brightHeadPink = vec3(1.00, 0.54, 0.90);
    vec3 streakHeadWhite = vec3(1.00, 0.90, 0.98);
    vec3 tailPurple = mix(deepTailViolet, brightTailOrchid, shadeFactor);
    vec3 headPink = mix(warmHeadRose, brightHeadPink, shadeFactor);
    float gradientFactor = clamp((v_quad_uv.x + 0.55) / 1.20, 0.0, 1.0);
    vec3 streakColor = mix(tailPurple, headPink, gradientFactor);
    streakColor += streakHeadWhite * streakHead * 0.72;
    vec3 streakRgb = streakColor * streakGlow * v_alpha * emissiveGain;
    float streakAlpha =
        clamp(streakGlow * v_alpha * 0.58, 0.0, 0.76) * u_light_mode;
    outColor = vec4(streakRgb, streakAlpha);
}
`
);

export const LABEL_FRAGMENT_SHADER_SOURCE: GlslSource = asGlslSource(
    `#version 300 es
precision highp float;

in vec2 v_quad_uv;

uniform sampler2D u_texture;
uniform float u_alpha;

out vec4 outColor;

void main() {
    vec4 texel = texture(u_texture, v_quad_uv);
    outColor = texel * u_alpha;
}
`
);

function fillLabelTextWithShadow(
    canvasContext: CanvasRenderingContext2D,
    textValue: string,
    designX: number,
    designY: number,
    isLightMode: boolean
): void {
    if (!isLightMode) {
        canvasContext.fillText(textValue, designX, designY);
        return;
    }
    canvasContext.save();
    canvasContext.shadowColor = LABEL_DROP_SHADOW_COLOR;
    canvasContext.shadowBlur = 2.0;
    canvasContext.shadowOffsetX = OFFSCREEN_PIXEL_SHIFT;
    canvasContext.shadowOffsetY = 2.0;
    canvasContext.fillText(
        textValue,
        designX - OFFSCREEN_DESIGN_SHIFT,
        designY
    );

    canvasContext.shadowColor = LABEL_RIM_SHADOW_COLOR;
    canvasContext.shadowBlur = 2.0;
    canvasContext.shadowOffsetX = 0.0;
    canvasContext.shadowOffsetY = 0.0;
    canvasContext.fillText(textValue, designX, designY);
    canvasContext.restore();
}

function drawRegionBadgeShadow(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    isLightMode: boolean
): void {
    if (!isLightMode) {
        return;
    }
    canvasContext.save();
    canvasContext.fillStyle = SHADOW_BACKING_FILL;
    canvasContext.shadowColor = LABEL_DROP_SHADOW_COLOR;
    canvasContext.shadowBlur = 2.0;
    canvasContext.shadowOffsetX = 0.0;
    canvasContext.shadowOffsetY = 2.0;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.shadowColor = LABEL_RIM_SHADOW_COLOR;
    canvasContext.shadowBlur = 2.0;
    canvasContext.shadowOffsetX = 0.0;
    canvasContext.shadowOffsetY = 0.0;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();
}

function drawUnitedStatesBadge(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    isLightMode: boolean
): void {
    drawRegionBadgeShadow(
        canvasContext,
        centerX,
        centerY,
        badgeRadius,
        isLightMode
    );
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.clip();

    const stripeCount: number = 7;
    const stripeHeight: number = (badgeRadius * 2) / stripeCount;
    const topEdgeY: number = centerY - badgeRadius;
    const leftEdgeX: number = centerX - badgeRadius;

    for (
        let stripeIndex: number = 0;
        stripeIndex < stripeCount;
        stripeIndex++
    ) {
        const stripeColor: CssColorValue =
            stripeIndex % 2 === 0 ? FLAG_CRIMSON_COLOR : FLAG_WHITE_COLOR;
        canvasContext.fillStyle = stripeColor;
        canvasContext.fillRect(
            leftEdgeX,
            topEdgeY + stripeIndex * stripeHeight,
            badgeRadius * 2,
            stripeHeight + 0.5
        );
    }

    canvasContext.fillStyle = FLAG_CANTON_COLOR;
    canvasContext.fillRect(
        leftEdgeX,
        topEdgeY,
        badgeRadius * 1.1,
        badgeRadius * 1.05
    );

    canvasContext.fillStyle = PURE_WHITE_COLOR;
    for (let starRow: number = 0; starRow < 2; starRow++) {
        for (let starColumn: number = 0; starColumn < 3; starColumn++) {
            const columnStep: number = starColumn * (badgeRadius * 0.28);
            const starX: number = leftEdgeX + badgeRadius * 0.3 + columnStep;
            const starY: number =
                topEdgeY + badgeRadius * 0.35 + starRow * (badgeRadius * 0.34);
            canvasContext.beginPath();
            canvasContext.arc(starX, starY, 1.3, 0, Math.PI * 2);
            canvasContext.fill();
        }
    }
    canvasContext.restore();

    canvasContext.save();
    canvasContext.strokeStyle = FLAG_RING_STROKE;
    canvasContext.lineWidth = 1.5;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.stroke();
    canvasContext.restore();
}

function drawBadgeRing(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    strokeColor: CssColorValue,
    isLightMode: boolean
): void {
    canvasContext.save();
    canvasContext.fillStyle = isLightMode
        ? LIGHT_BADGE_DISC_FILL
        : DARK_BADGE_DISC_FILL;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.strokeStyle = strokeColor;
    canvasContext.lineWidth = 5.0;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.stroke();
    canvasContext.restore();
}

function drawQuadrilateralPane(
    canvasContext: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number
): void {
    canvasContext.beginPath();
    canvasContext.moveTo(x0, y0);
    canvasContext.lineTo(x1, y1);
    canvasContext.lineTo(x2, y2);
    canvasContext.lineTo(x3, y3);
    canvasContext.closePath();
    canvasContext.fill();
}

function drawWindowsBadge(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    isLightMode: boolean
): void {
    drawBadgeRing(
        canvasContext,
        centerX,
        centerY,
        badgeRadius,
        WINDOWS_ACCENT_COLOR,
        isLightMode
    );

    canvasContext.save();
    canvasContext.fillStyle = WINDOWS_ACCENT_COLOR;

    drawQuadrilateralPane(
        canvasContext,
        centerX - 16.0,
        centerY - 12.0,
        centerX - 2.2,
        centerY - 13.9,
        centerX - 2.2,
        centerY - 1.5,
        centerX - 16.0,
        centerY - 1.5
    );
    drawQuadrilateralPane(
        canvasContext,
        centerX + 0.8,
        centerY - 14.3,
        centerX + 16.2,
        centerY - 16.4,
        centerX + 16.2,
        centerY - 1.5,
        centerX + 0.8,
        centerY - 1.5
    );
    drawQuadrilateralPane(
        canvasContext,
        centerX - 16.0,
        centerY + 1.5,
        centerX - 2.2,
        centerY + 1.5,
        centerX - 2.2,
        centerY + 13.9,
        centerX - 16.0,
        centerY + 12.0
    );
    drawQuadrilateralPane(
        canvasContext,
        centerX + 0.8,
        centerY + 1.5,
        centerX + 16.2,
        centerY + 1.5,
        centerX + 16.2,
        centerY + 16.4,
        centerX + 0.8,
        centerY + 14.3
    );
    canvasContext.restore();
}

function drawAndroidBadge(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    isLightMode: boolean
): void {
    drawBadgeRing(
        canvasContext,
        centerX,
        centerY,
        badgeRadius,
        ANDROID_ACCENT_COLOR,
        isLightMode
    );

    canvasContext.save();
    canvasContext.fillStyle = ANDROID_ACCENT_COLOR;
    canvasContext.strokeStyle = ANDROID_ACCENT_COLOR;
    canvasContext.lineWidth = 3.2;
    canvasContext.lineCap = "round";

    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY + 9.5, 18.2, Math.PI, 0, false);
    canvasContext.closePath();
    canvasContext.fill();

    canvasContext.beginPath();
    canvasContext.moveTo(centerX - 9.2, centerY - 4.5);
    canvasContext.lineTo(centerX - 14.5, centerY - 13.5);
    canvasContext.moveTo(centerX + 9.2, centerY - 4.5);
    canvasContext.lineTo(centerX + 14.5, centerY - 13.5);
    canvasContext.stroke();

    canvasContext.fillStyle = ANDROID_EYE_COLOR;
    canvasContext.beginPath();
    canvasContext.arc(centerX - 8.2, centerY + 2.0, 2.3, 0, Math.PI * 2);
    canvasContext.arc(centerX + 8.2, centerY + 2.0, 2.3, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();
}

function drawAppleBadge(
    canvasContext: CanvasRenderingContext2D,
    centerX: CanvasDesignUnits,
    centerY: CanvasDesignUnits,
    badgeRadius: CanvasDesignUnits,
    isLightMode: boolean
): void {
    drawBadgeRing(
        canvasContext,
        centerX,
        centerY,
        badgeRadius,
        APPLE_ACCENT_COLOR,
        isLightMode
    );

    canvasContext.save();
    canvasContext.fillStyle = APPLE_ACCENT_COLOR;
    canvasContext.translate(centerX - 11.6 * 1.46, centerY - 12.2 * 1.46);
    canvasContext.scale(1.46, 1.46);

    canvasContext.beginPath();
    canvasContext.moveTo(12.0, 6.8);
    canvasContext.bezierCurveTo(10.5, 6.8, 9.2, 5.6, 7.6, 5.7);
    canvasContext.bezierCurveTo(5.1, 5.8, 2.8, 7.6, 2.8, 11.4);
    canvasContext.bezierCurveTo(2.8, 15.6, 5.9, 22.2, 8.5, 22.2);
    canvasContext.bezierCurveTo(9.9, 22.2, 10.6, 21.2, 12.1, 21.2);
    canvasContext.bezierCurveTo(13.6, 21.2, 14.2, 22.2, 15.7, 22.2);
    canvasContext.bezierCurveTo(17.7, 22.2, 19.3, 19.0, 20.2, 16.6);
    canvasContext.bezierCurveTo(17.1, 15.3, 16.7, 10.5, 19.6, 8.8);
    canvasContext.bezierCurveTo(18.3, 6.8, 16.4, 5.7, 14.5, 5.7);
    canvasContext.bezierCurveTo(13.0, 5.7, 12.9, 6.8, 12.0, 6.8);
    canvasContext.closePath();
    canvasContext.fill();

    canvasContext.beginPath();
    canvasContext.moveTo(11.9, 5.5);
    canvasContext.bezierCurveTo(11.7, 3.2, 13.7, 1.1, 16.0, 0.9);
    canvasContext.bezierCurveTo(16.3, 3.3, 14.2, 5.6, 11.9, 5.5);
    canvasContext.closePath();
    canvasContext.fill();
    canvasContext.restore();
}

function buildStaticChromeCanvas(
    isLightMode: boolean
): HTMLCanvasElement | null {
    const templateCanvas: HTMLCanvasElement = document.createElement("canvas");
    templateCanvas.width = LABEL_TEXTURE_WIDTH;
    templateCanvas.height = LABEL_TEXTURE_HEIGHT;
    const canvasContext: CanvasRenderingContext2D | null =
        templateCanvas.getContext("2d");
    if (!canvasContext) {
        return null;
    }

    canvasContext.scale(LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
    const centerX: CanvasDesignUnits = asDesignUnits(DESIGN_WIDTH * 0.5);
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "alphabetic";
    canvasContext.fillStyle = LABEL_TEXT_COLOR;

    canvasContext.font = TITLE_FONT_SPEC;
    fillLabelTextWithShadow(
        canvasContext,
        "Coming Soon",
        centerX,
        58,
        isLightMode
    );

    canvasContext.font = SUBTITLE_FONT_SPEC;
    fillLabelTextWithShadow(
        canvasContext,
        "Dezzyne",
        centerX,
        114,
        isLightMode
    );

    const platformCenterY: CanvasDesignUnits = asDesignUnits(371);
    const platformRadius: CanvasDesignUnits = asDesignUnits(35);
    const platformSpacing: number = 80;
    const firstPlatformX: CanvasDesignUnits = asDesignUnits(centerX + 217);
    const secondPlatformX: CanvasDesignUnits = asDesignUnits(
        firstPlatformX + platformSpacing
    );
    const thirdPlatformX: CanvasDesignUnits = asDesignUnits(
        firstPlatformX + platformSpacing * 2
    );

    drawWindowsBadge(
        canvasContext,
        firstPlatformX,
        platformCenterY,
        platformRadius,
        isLightMode
    );
    drawAndroidBadge(
        canvasContext,
        secondPlatformX,
        platformCenterY,
        platformRadius,
        isLightMode
    );
    drawAppleBadge(
        canvasContext,
        thirdPlatformX,
        platformCenterY,
        platformRadius,
        isLightMode
    );
    return templateCanvas;
}

function paintDynamicLabel(
    canvasContext: CanvasRenderingContext2D,
    staticChromeCanvas: HTMLCanvasElement,
    instanceIdentifier: number,
    playerCount: number,
    countdownSeconds: number,
    isLightMode: boolean
): void {
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, LABEL_TEXTURE_WIDTH, LABEL_TEXTURE_HEIGHT);
    canvasContext.drawImage(staticChromeCanvas, 0, 0);

    canvasContext.setTransform(
        LABEL_RENDER_SCALE,
        0,
        0,
        LABEL_RENDER_SCALE,
        0,
        0
    );
    const centerX: CanvasDesignUnits = asDesignUnits(DESIGN_WIDTH * 0.5);
    const regionText: string = `(W) #${String(instanceIdentifier)}  Public`;
    canvasContext.font = METADATA_FONT_SPEC;
    const measuredMetrics: TextMetrics = canvasContext.measureText(regionText);
    const regionTextWidth: number = measuredMetrics.width;
    const badgeRadius: CanvasDesignUnits = asDesignUnits(14);
    const badgeGap: number = 11;
    const rowWidth: number = badgeRadius * 2 + badgeGap + regionTextWidth;
    const rowStartX: number = centerX - rowWidth * 0.5;
    const badgeCenterX: CanvasDesignUnits = asDesignUnits(
        rowStartX + badgeRadius
    );
    const badgeCenterY: CanvasDesignUnits = asDesignUnits(170 - 11);

    drawUnitedStatesBadge(
        canvasContext,
        badgeCenterX,
        badgeCenterY,
        badgeRadius,
        isLightMode
    );

    canvasContext.textAlign = "left";
    canvasContext.textBaseline = "alphabetic";
    canvasContext.fillStyle = LABEL_TEXT_COLOR;
    fillLabelTextWithShadow(
        canvasContext,
        regionText,
        rowStartX + badgeRadius * 2 + badgeGap,
        170,
        isLightMode
    );

    const occupancyText: string = `${String(playerCount)} / 80`;
    canvasContext.textAlign = "center";
    canvasContext.font = METADATA_FONT_SPEC;
    fillLabelTextWithShadow(
        canvasContext,
        occupancyText,
        centerX,
        226,
        isLightMode
    );

    const countdownText: string = String(countdownSeconds);
    canvasContext.font = COUNTDOWN_FONT_SPEC;
    fillLabelTextWithShadow(
        canvasContext,
        countdownText,
        centerX,
        288,
        isLightMode
    );
}

export function createLabelManager(
    glContext: WebGL2RenderingContext,
    initialLightMode?: boolean
): LabelManager | null {
    let isLightMode: boolean = Boolean(initialLightMode);
    const initialChromeCanvas: HTMLCanvasElement | null =
        buildStaticChromeCanvas(isLightMode);
    const workCanvas: HTMLCanvasElement = document.createElement("canvas");
    workCanvas.width = LABEL_TEXTURE_WIDTH;
    workCanvas.height = LABEL_TEXTURE_HEIGHT;
    const workContext: CanvasRenderingContext2D | null =
        workCanvas.getContext("2d");
    if (!initialChromeCanvas || !workContext) {
        return null;
    }

    let staticChromeCanvas: HTMLCanvasElement = initialChromeCanvas;
    const renderingContext: CanvasRenderingContext2D = workContext;
    const labelSlots: LabelSlot[] = [];
    let isDisposed: boolean = false;

    function refreshFontLabels(): void {
        if (isDisposed) {
            return;
        }
        const refreshedChromeCanvas: HTMLCanvasElement | null =
            buildStaticChromeCanvas(isLightMode);
        if (!refreshedChromeCanvas) {
            return;
        }
        staticChromeCanvas = refreshedChromeCanvas;
        for (
            let slotIndex: number = 0;
            slotIndex < labelSlots.length;
            slotIndex++
        ) {
            labelSlots[slotIndex].isReady = false;
        }
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refreshFontLabels);
    }

    function allocateTexture(): WebGLTexture | null {
        const texture: WebGLTexture | null = glContext.createTexture();
        if (!texture) {
            return null;
        }
        glContext.bindTexture(glContext.TEXTURE_2D, texture);
        glContext.texParameteri(
            glContext.TEXTURE_2D,
            glContext.TEXTURE_WRAP_S,
            glContext.CLAMP_TO_EDGE
        );
        glContext.texParameteri(
            glContext.TEXTURE_2D,
            glContext.TEXTURE_WRAP_T,
            glContext.CLAMP_TO_EDGE
        );
        glContext.texParameteri(
            glContext.TEXTURE_2D,
            glContext.TEXTURE_MIN_FILTER,
            glContext.LINEAR
        );
        glContext.texParameteri(
            glContext.TEXTURE_2D,
            glContext.TEXTURE_MAG_FILTER,
            glContext.LINEAR
        );
        return texture;
    }

    return {
        aspectRatio: LABEL_ASPECT_RATIO,
        slots: labelSlots,
        setLightMode(nextLightMode: boolean): void {
            const normalizedLight: boolean = Boolean(nextLightMode);
            if (isDisposed || normalizedLight === isLightMode) {
                return;
            }
            isLightMode = normalizedLight;
            refreshFontLabels();
        },
        synchronize(
            portalCount: ElementCount,
            metadataView: PortalMetadataBuffer
        ): void {
            if (!metadataView || portalCount <= 0) {
                return;
            }
            while (labelSlots.length < portalCount) {
                const texture: WebGLTexture | null = allocateTexture();
                if (!texture) {
                    return;
                }
                const freshSlot: LabelSlot = {
                    texture,
                    previousSeconds: -1,
                    previousIdentifier: 0,
                    isReady: false,
                };
                labelSlots.push(freshSlot);
            }
            for (
                let portalIndex: number = 0;
                portalIndex < portalCount;
                portalIndex++
            ) {
                const slot: LabelSlot = labelSlots[portalIndex];
                const baseOffset: number =
                    portalIndex * METADATA_U32S_PER_PORTAL;
                const instanceIdentifier: number = metadataView[baseOffset];
                const playerCount: number = metadataView[baseOffset + 1];
                const countdownSeconds: number = metadataView[baseOffset + 2];
                const unchanged: boolean =
                    countdownSeconds === slot.previousSeconds &&
                    instanceIdentifier === slot.previousIdentifier;
                if (slot.isReady && unchanged) {
                    continue;
                }
                slot.previousSeconds = countdownSeconds;
                slot.previousIdentifier = instanceIdentifier;
                slot.isReady = true;
                paintDynamicLabel(
                    renderingContext,
                    staticChromeCanvas,
                    instanceIdentifier,
                    playerCount,
                    countdownSeconds,
                    isLightMode
                );
                glContext.bindTexture(glContext.TEXTURE_2D, slot.texture);
                glContext.pixelStorei(
                    glContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
                    true
                );
                glContext.texImage2D(
                    glContext.TEXTURE_2D,
                    0,
                    glContext.RGBA,
                    glContext.RGBA,
                    glContext.UNSIGNED_BYTE,
                    workCanvas
                );
            }
        },
        dispose(): void {
            isDisposed = true;
            for (
                let slotIndex: number = 0;
                slotIndex < labelSlots.length;
                slotIndex++
            ) {
                glContext.deleteTexture(labelSlots[slotIndex].texture);
            }
            labelSlots.length = 0;
        },
    };
}
