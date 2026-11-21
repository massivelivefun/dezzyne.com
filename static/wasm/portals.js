const { Math, String } = globalThis;

export const PARTICLE_FLOATS = 8;
export const METADATA_U32S_PER_PORTAL = 4;

const DESIGN_WIDTH = 920;
const DESIGN_HEIGHT = 428;
const LABEL_TEXTURE_WIDTH = 640;
const LABEL_TEXTURE_HEIGHT = 298;
const LABEL_RENDER_SCALE = LABEL_TEXTURE_WIDTH / DESIGN_WIDTH;
const LABEL_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;
const LABEL_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export const PORTAL_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform int u_zero;
uniform vec4 u_camera[5];
uniform vec4 u_portal[3];
uniform vec4 u_portal_rings[2];
uniform float u_phase_offset;

out vec4 outColor;

float valueNoiseSimd(vec2 position) {
    vec2 cellIndex = floor(position);
    vec2 cellFraction = fract(position);
    vec2 smoothStepUv =
        cellFraction * cellFraction * (3.0 - 2.0 * cellFraction);
    vec4 cornerX = fract((cellIndex.x + vec4(0.0, 1.0, 0.0, 1.0)) * 123.34);
    vec4 cornerY = fract((cellIndex.y + vec4(0.0, 0.0, 1.0, 1.0)) * 456.21);
    vec4 dotOffset = cornerX * (cornerX + 45.32) + cornerY * (cornerY + 45.32);
    vec4 cornerHashes = fract((cornerX + dotOffset) * (cornerY + dotOffset));
    vec2 horizontalMix = mix(
        cornerHashes.xz,
        cornerHashes.yw,
        smoothStepUv.x
    );
    return mix(horizontalMix.x, horizontalMix.y, smoothStepUv.y);
}

float evaluatePortalRings(float radialDistance, vec4 radii, vec4 alphas) {
    vec4 radialDelta = radialDistance - radii;
    vec4 squaredDelta = radialDelta * radialDelta;
    vec4 ringProfile =
        exp(-squaredDelta * 34.0) + exp(-squaredDelta * 5.5) * 0.45;
    return dot(ringProfile, alphas);
}

void main() {
    float pixelX = gl_FragCoord.x / u_device_pixel_ratio;
    float pixelY = u_resolution.y - gl_FragCoord.y / u_device_pixel_ratio;
    vec2 pixelPosition = vec2(pixelX, pixelY);

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
    vec3 auraColor =
        vec3(0.16, 0.54, 1.00) * auraIntensity * 0.52 * popAlpha;

    if (normalizedRadius > 1.04) {
        outColor = vec4(auraColor, 0.0);
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
    vortexColor = mix(
        vortexColor,
        vec3(0.24, 0.66, 1.00),
        innerRimFactor * 0.62
    );

    float shimmerPhase =
        polarAngle * 3.0 - animationTime * 2.8 + primaryNoise * 3.0;
    float rimShimmer = 0.88 + 0.12 * sin(shimmerPhase);
    float rimMask = 1.0 - smoothstep(-1.2, 1.2, edgeDistancePixels);
    float rimLine = exp(-abs(edgeDistancePixels + 1.5) * 0.62) * rimMask;
    vec3 rimColor = vec3(0.54, 0.86, 1.00) * rimShimmer;

    float halfHeight = max(u_resolution.y * 0.5, 1.0);
    float tangentFov = u_camera[0].w;
    float horizontalTangent =
        ((pixelPosition.x - u_resolution.x * 0.5) / halfHeight) * tangentFov;
    float verticalTangent =
        ((u_resolution.y * 0.5 - pixelPosition.y) / halfHeight) * tangentFov;
    vec3 unnormalizedRay = u_camera[1].xyz
        + horizontalTangent * u_camera[2].xyz
        + verticalTangent * u_camera[3].xyz;
    vec3 rayDirection = normalize(unnormalizedRay);
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
    vec3 ringGlow = vec3(0.18, 0.60, 1.00)
        * min(ringSum, 2.2)
        * ringVisibility
        * 0.92;
    float foregroundRingMask = smoothstep(
        u_portal[1].y + 0.04,
        u_portal[1].y - 0.04,
        ringPlaneXz.y
    );

    vec3 premultipliedColor = auraColor * (1.0 - portalMask)
        + vortexColor * portalMask
        + rimColor * rimLine * 0.76 * popAlpha
        + ringGlow * foregroundRingMask * portalMask;

    outColor = vec4(premultipliedColor, portalMask);
}
`;

export const PARTICLE_VERTEX_SHADER_SOURCE = `#version 300 es
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
`;

export const PARTICLE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_quad_uv;
in float v_alpha;
in float v_tint_code;

out vec4 outColor;

void main() {
    float radiusSquared = dot(v_quad_uv, v_quad_uv);
    if (v_tint_code < 0.5 && radiusSquared > 1.0) {
        discard;
    }
    if (v_tint_code < 0.5) {
        float moteCore = exp(-radiusSquared * 6.8);
        float moteHalo = exp(-radiusSquared * 2.2) * (1.0 - radiusSquared);
        float moteGlow = moteCore * 0.82 + moteHalo * 0.58;

        float colorBlend = clamp(v_tint_code * 2.2, 0.0, 1.0);
        vec3 deepBlue = vec3(0.20, 0.64, 1.00);
        vec3 skyBlue = vec3(0.38, 0.80, 1.00);
        vec3 baseColor = mix(deepBlue, skyBlue, colorBlend);
        vec3 moteColor = baseColor + vec3(0.86, 0.96, 1.00) * moteCore * 0.50;
        outColor = vec4(moteColor * moteGlow * v_alpha, 1.0);
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
    vec3 tailPurple = mix(
        vec3(0.54, 0.20, 0.96),
        vec3(0.72, 0.26, 0.94),
        shadeFactor
    );
    vec3 headPink = mix(
        vec3(0.94, 0.38, 0.86),
        vec3(1.00, 0.54, 0.90),
        shadeFactor
    );
    float gradientFactor = clamp((v_quad_uv.x + 0.55) / 1.20, 0.0, 1.0);
    vec3 streakColor = mix(tailPurple, headPink, gradientFactor);
    streakColor += vec3(1.00, 0.90, 0.98) * streakHead * 0.72;

    outColor = vec4(streakColor * streakGlow * v_alpha, 1.0);
}
`;

export const LABEL_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_quad_uv;

uniform sampler2D u_texture;
uniform float u_alpha;

out vec4 outColor;

void main() {
    vec4 texel = texture(u_texture, v_quad_uv);
    outColor = texel * u_alpha;
}
`;

function drawUnitedStatesBadge(canvasContext, centerX, centerY, badgeRadius) {
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.clip();

    const stripeCount = 7;
    const stripeHeight = (badgeRadius * 2) / stripeCount;
    const topEdgeY = centerY - badgeRadius;
    const leftEdgeX = centerX - badgeRadius;

    for (let stripeIndex = 0; stripeIndex < stripeCount; stripeIndex++) {
        canvasContext.fillStyle =
            stripeIndex % 2 === 0 ? "#d92b3a" : "#f4f6f9";
        canvasContext.fillRect(
            leftEdgeX,
            topEdgeY + stripeIndex * stripeHeight,
            badgeRadius * 2,
            stripeHeight + 0.5
        );
    }

    canvasContext.fillStyle = "#1c4ca8";
    canvasContext.fillRect(
        leftEdgeX,
        topEdgeY,
        badgeRadius * 1.1,
        badgeRadius * 1.05
    );

    canvasContext.fillStyle = "#ffffff";
    for (let starRow = 0; starRow < 2; starRow++) {
        for (let starColumn = 0; starColumn < 3; starColumn++) {
            const columnStep = starColumn * (badgeRadius * 0.28);
            const starX = leftEdgeX + badgeRadius * 0.3 + columnStep;
            const starY =
                topEdgeY + badgeRadius * 0.35 + starRow * (badgeRadius * 0.34);
            canvasContext.beginPath();
            canvasContext.arc(starX, starY, 1.3, 0, Math.PI * 2);
            canvasContext.fill();
        }
    }
    canvasContext.restore();

    canvasContext.save();
    canvasContext.strokeStyle = "rgba(255, 255, 255, 0.85)";
    canvasContext.lineWidth = 1.5;
    canvasContext.beginPath();
    canvasContext.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    canvasContext.stroke();
    canvasContext.restore();
}

function drawBadgeRing(
    canvasContext,
    centerX,
    centerY,
    badgeRadius,
    strokeColor
) {
    canvasContext.save();
    canvasContext.fillStyle = "rgba(14, 18, 26, 0.54)";
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
    canvasContext,
    x0,
    y0,
    x1,
    y1,
    x2,
    y2,
    x3,
    y3
) {
    canvasContext.beginPath();
    canvasContext.moveTo(x0, y0);
    canvasContext.lineTo(x1, y1);
    canvasContext.lineTo(x2, y2);
    canvasContext.lineTo(x3, y3);
    canvasContext.closePath();
    canvasContext.fill();
}

function drawWindowsBadge(canvasContext, centerX, centerY, badgeRadius) {
    const accentColor = "#00a8ff";
    drawBadgeRing(canvasContext, centerX, centerY, badgeRadius, accentColor);

    canvasContext.save();
    canvasContext.fillStyle = accentColor;

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

function drawAndroidBadge(canvasContext, centerX, centerY, badgeRadius) {
    const accentColor = "#2ed57a";
    drawBadgeRing(canvasContext, centerX, centerY, badgeRadius, accentColor);

    canvasContext.save();
    canvasContext.fillStyle = accentColor;
    canvasContext.strokeStyle = accentColor;
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

    canvasContext.fillStyle = "#121822";
    canvasContext.beginPath();
    canvasContext.arc(centerX - 8.2, centerY + 2.0, 2.3, 0, Math.PI * 2);
    canvasContext.arc(centerX + 8.2, centerY + 2.0, 2.3, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();
}

function drawAppleBadge(canvasContext, centerX, centerY, badgeRadius) {
    const accentColor = "#e8eaf2";
    drawBadgeRing(canvasContext, centerX, centerY, badgeRadius, accentColor);

    canvasContext.save();
    canvasContext.fillStyle = accentColor;
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

function buildStaticChromeCanvas() {
    const templateCanvas = document.createElement("canvas");
    templateCanvas.width = LABEL_TEXTURE_WIDTH;
    templateCanvas.height = LABEL_TEXTURE_HEIGHT;
    const canvasContext = templateCanvas.getContext("2d");
    if (!canvasContext) {
        return null;
    }

    canvasContext.scale(LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
    const centerX = DESIGN_WIDTH * 0.5;
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "alphabetic";
    canvasContext.fillStyle = "#f5f7fa";

    canvasContext.font = `500 42px ${LABEL_FONT_FAMILY}`;
    canvasContext.fillText("Coming Soon", centerX, 58);

    canvasContext.font = `400 34px ${LABEL_FONT_FAMILY}`;
    canvasContext.fillText("Dezzyne", centerX, 114);

    const platformCenterY = 371;
    const platformRadius = 35;
    const platformSpacing = 80;
    const firstPlatformX = centerX + 217;

    drawWindowsBadge(
        canvasContext,
        firstPlatformX,
        platformCenterY,
        platformRadius
    );
    drawAndroidBadge(
        canvasContext,
        firstPlatformX + platformSpacing,
        platformCenterY,
        platformRadius
    );
    drawAppleBadge(
        canvasContext,
        firstPlatformX + platformSpacing * 2,
        platformCenterY,
        platformRadius
    );
    return templateCanvas;
}

function paintDynamicLabel(
    canvasContext,
    staticChromeCanvas,
    instanceIdentifier,
    playerCount,
    countdownSeconds
) {
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
    const centerX = DESIGN_WIDTH * 0.5;
    const regionText = `(W) #${String(instanceIdentifier)}  Public`;
    canvasContext.font = `400 32px ${LABEL_FONT_FAMILY}`;
    const regionTextWidth = canvasContext.measureText(regionText).width;
    const badgeRadius = 14;
    const badgeGap = 11;
    const rowWidth = badgeRadius * 2 + badgeGap + regionTextWidth;
    const rowStartX = centerX - rowWidth * 0.5;

    drawUnitedStatesBadge(
        canvasContext,
        rowStartX + badgeRadius,
        170 - 11,
        badgeRadius
    );

    canvasContext.textAlign = "left";
    canvasContext.textBaseline = "alphabetic";
    canvasContext.fillStyle = "#f5f7fa";
    canvasContext.fillText(
        regionText,
        rowStartX + badgeRadius * 2 + badgeGap,
        170
    );

    canvasContext.textAlign = "center";
    canvasContext.font = `400 32px ${LABEL_FONT_FAMILY}`;
    canvasContext.fillText(`${String(playerCount)} / 80`, centerX, 226);

    canvasContext.font = `700 42px ${LABEL_FONT_FAMILY}`;
    canvasContext.fillText(String(countdownSeconds), centerX, 288);
}

export function createLabelManager(glContext) {
    const staticChromeCanvas = buildStaticChromeCanvas();
    const workCanvas = document.createElement("canvas");
    workCanvas.width = LABEL_TEXTURE_WIDTH;
    workCanvas.height = LABEL_TEXTURE_HEIGHT;
    const workContext = workCanvas.getContext("2d");
    if (!staticChromeCanvas || !workContext) {
        return null;
    }

    const labelSlots = [];

    function allocateTexture() {
        const texture = glContext.createTexture();
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
        synchronize(portalCount, metadataView) {
            if (!metadataView || portalCount <= 0) {
                return;
            }
            while (labelSlots.length < portalCount) {
                const texture = allocateTexture();
                if (!texture) {
                    return;
                }
                labelSlots.push({
                    texture,
                    previousSeconds: -1,
                    previousIdentifier: 0,
                    isReady: false,
                });
            }
            for (
                let portalIndex = 0;
                portalIndex < portalCount;
                portalIndex++
            ) {
                const slot = labelSlots[portalIndex];
                const baseOffset = portalIndex * METADATA_U32S_PER_PORTAL;
                const instanceIdentifier = metadataView[baseOffset];
                const playerCount = metadataView[baseOffset + 1];
                const countdownSeconds = metadataView[baseOffset + 2];
                const unchanged =
                    countdownSeconds === slot.previousSeconds &&
                    instanceIdentifier === slot.previousIdentifier;
                if (slot.isReady && unchanged) {
                    continue;
                }
                slot.previousSeconds = countdownSeconds;
                slot.previousIdentifier = instanceIdentifier;
                slot.isReady = true;
                paintDynamicLabel(
                    workContext,
                    staticChromeCanvas,
                    instanceIdentifier,
                    playerCount,
                    countdownSeconds
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
        dispose() {
            for (
                let slotIndex = 0;
                slotIndex < labelSlots.length;
                slotIndex++
            ) {
                glContext.deleteTexture(labelSlots[slotIndex].texture);
            }
            labelSlots.length = 0;
        },
    };
}
