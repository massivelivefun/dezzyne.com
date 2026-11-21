export const KEYPAD_FLOATS = 16;

export const KEYPAD_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform int u_zero;
uniform vec4 u_camera[5];
uniform vec4 u_keypad[4];

out vec4 outColor;

float hash2d(vec2 gridPoint) {
    vec2 folded = fract(gridPoint * vec2(123.34, 456.21));
    folded += dot(folded, folded + 45.32);
    return fract(folded.x * folded.y);
}

float valueNoise(vec2 position) {
    vec2 cellIndex = floor(position);
    vec2 cellFraction = fract(position);
    vec2 smoothStepUv =
        cellFraction * cellFraction * (3.0 - 2.0 * cellFraction);
    float corner00 = hash2d(cellIndex);
    float corner10 = hash2d(cellIndex + vec2(1.0, 0.0));
    float corner01 = hash2d(cellIndex + vec2(0.0, 1.0));
    float corner11 = hash2d(cellIndex + vec2(1.0, 1.0));
    return mix(
        mix(corner00, corner10, smoothStepUv.x),
        mix(corner01, corner11, smoothStepUv.x),
        smoothStepUv.y
    );
}

float signedDistanceRoundedRectangle(
    vec2 point2d,
    vec2 halfExtents,
    float cornerRadius
) {
    vec2 offset = abs(point2d) - (halfExtents - vec2(cornerRadius));
    return length(max(offset, 0.0))
        + min(max(offset.x, offset.y), 0.0)
        - cornerRadius;
}

float signedDistanceExtrudedRectangle(
    vec3 point3d,
    vec2 halfExtents,
    float cornerRadius,
    float bottomZ,
    float topZ,
    float filletRadius
) {
    float planarDistance =
        signedDistanceRoundedRectangle(point3d.xy, halfExtents, cornerRadius)
        + filletRadius;
    float centerZ = 0.5 * (bottomZ + topZ);
    float halfHeightZ = 0.5 * (topZ - bottomZ);
    float verticalDistance =
        abs(point3d.z - centerZ) - (halfHeightZ - filletRadius);
    vec2 profileOffset = vec2(planarDistance, verticalDistance);
    return min(max(profileOffset.x, profileOffset.y), 0.0)
        + length(max(profileOffset, 0.0))
        - filletRadius;
}

vec4 evaluateKeypadDistances(vec3 localPoint) {
    float outerBezel = signedDistanceExtrudedRectangle(
        localPoint,
        vec2(60.0),
        10.0,
        0.0,
        5.4,
        1.0
    );
    float innerPocket = signedDistanceExtrudedRectangle(
        localPoint,
        vec2(51.25),
        5.0,
        1.0,
        10.0,
        0.5
    );
    float bezelDistance = max(outerBezel, -innerPocket);
    float plateDistance = signedDistanceExtrudedRectangle(
        localPoint,
        vec2(50.0),
        5.0,
        1.0,
        2.0,
        0.2
    );

    vec2 cellCoords = clamp(floor(localPoint.xy * 0.04761905) + 2.0, 0.0, 3.0);
    float isOuterRow = step(2.5, cellCoords.y) + step(cellCoords.y, 0.5);
    float isOuterColumn = step(2.5, cellCoords.x) + step(cellCoords.x, 0.5);
    float widerX = step(abs(localPoint.y), abs(localPoint.x));
    float shouldClampRow = isOuterRow * isOuterColumn * widerX;
    float shouldClampColumn = isOuterRow * (1.0 - shouldClampRow);
    cellCoords.x = mix(
        cellCoords.x,
        clamp(cellCoords.x, 1.0, 2.0),
        shouldClampColumn
    );
    cellCoords.y = mix(
        cellCoords.y,
        clamp(cellCoords.y, 1.0, 2.0),
        shouldClampRow
    );
    vec3 keyPoint = vec3(
        localPoint.xy - (cellCoords - 1.5) * 21.0,
        localPoint.z
    );
    float keyBody = signedDistanceExtrudedRectangle(
        keyPoint,
        vec2(10.0),
        4.0,
        2.0,
        9.0,
        0.55
    );
    float fingerDish = length(keyPoint - vec3(0.0, 0.0, 35.774)) - 28.274;
    float blendWeight =
        clamp(0.5 - 0.5 * (keyBody + fingerDish) * 2.857143, 0.0, 1.0);
    float keysDistance = mix(keyBody, -fingerDish, blendWeight)
        + 0.35 * blendWeight * (1.0 - blendWeight);

    float knobCenterX = (localPoint.x >= 0.0) ? 31.5 : -31.5;
    float knobTopZ = (localPoint.x >= 0.0) ? 21.5 : 19.0;
    vec2 knobOffset = abs(localPoint.xy - vec2(knobCenterX, 31.5));
    float radialDistance = length(knobOffset);
    vec2 foldedSector =
        (knobOffset.y > knobOffset.x) ? knobOffset.yx : knobOffset;
    vec2 rotatedSector = vec2(
        0.8660254 * foldedSector.x + 0.5 * foldedSector.y,
        abs(0.8660254 * foldedSector.y - 0.5 * foldedSector.x)
    );
    foldedSector =
        (foldedSector.y > foldedSector.x * 0.2679492)
            ? rotatedSector
            : foldedSector;
    float fluteCutout = length(foldedSector - vec2(8.45, 0.0)) - 2.15;
    float flutedCylinder = max(radialDistance - 8.0, -fluteCutout);
    float knobMidZ = 0.5 * (2.0 + knobTopZ);
    float knobHalfZ = 0.5 * (knobTopZ - 2.0);
    vec2 knobProfile = vec2(
        flutedCylinder + 0.32,
        abs(localPoint.z - knobMidZ) - (knobHalfZ - 0.32)
    );
    float knobsDistance = min(max(knobProfile.x, knobProfile.y), 0.0)
        + length(max(knobProfile, 0.0))
        - 0.32;

    return vec4(bezelDistance, plateDistance, keysDistance, knobsDistance);
}

vec3 evaluateBezelPalette(float gradientPosition) {
    vec3 mintColor = vec3(0.46, 0.99, 0.86);
    vec3 centerColor = vec3(0.76, 0.89, 1.00);
    vec3 violetColor = vec3(0.86, 0.56, 1.00);
    if (gradientPosition < 0.5) {
        return mix(mintColor, centerColor, gradientPosition * 2.0);
    }
    return mix(centerColor, violetColor, (gradientPosition - 0.5) * 2.0);
}

vec3 shadeKeypadSurface(
    vec3 hitPoint,
    vec3 localNormal,
    vec3 worldNormal,
    vec3 worldRayDirection,
    vec4 hitPartDistances,
    vec3 bezelHue,
    float hoverIntensity,
    float ambientOcclusion
) {
    float bezelHit = hitPartDistances.x;
    float plateHit = hitPartDistances.y;
    float keysHit = hitPartDistances.z;
    float knobsHit = hitPartDistances.w;
    float minimumPartDistance =
        min(min(bezelHit, plateHit), min(keysHit, knobsHit));

    if (bezelHit <= minimumPartDistance + 0.02) {
        float chebyshevRadius = max(abs(hitPoint.x), abs(hitPoint.y));
        float innerLightPipe = smoothstep(58.5, 51.2, chebyshevRadius);
        float topDiffusion = smoothstep(0.15, 0.95, localNormal.z);
        vec3 frostedAcrylic = mix(
            vec3(0.92, 0.97, 1.00),
            bezelHue,
            0.48 + 0.44 * innerLightPipe
        );
        vec3 bezelSurface = mix(bezelHue, frostedAcrylic, topDiffusion * 0.72);
        return bezelSurface * (1.04 + hoverIntensity * 0.12);
    }

    vec3 mintLightDirection = normalize(vec3(-0.76, 0.44, -0.48));
    vec3 violetLightDirection = normalize(vec3(0.78, -0.30, -0.55));
    vec3 topLightDirection = normalize(vec3(-0.08, 0.64, -0.76));

    float mintDiffuse = max(0.0, dot(worldNormal, mintLightDirection));
    float violetDiffuse = max(0.0, dot(worldNormal, violetLightDirection));
    float topDiffuse = max(0.0, dot(worldNormal, topLightDirection));

    bool isPlateHit = plateHit <= minimumPartDistance + 0.02;
    float screwRadius = length(abs(hitPoint.xy) - vec2(45.0));
    if (isPlateHit && screwRadius < 1.25 && hitPoint.z > 1.8) {
        float hexSocket = 1.0 - smoothstep(0.45, 0.58, screwRadius);
        return mix(vec3(0.76, 0.78, 0.82), vec3(0.14), hexSocket)
            * ambientOcclusion;
    }

    if (isPlateHit) {
        float brushedGrain =
            valueNoise(vec2(hitPoint.x * 0.5, hitPoint.y * 6.5));
        vec3 plateAlbedo =
            vec3(0.45, 0.46, 0.50) * (0.96 + 0.06 * brushedGrain);
        float directLight = 0.30 + 0.62 * topDiffuse;
        vec3 bounceLight = vec3(0.08, 0.28, 0.20) * mintDiffuse
            + vec3(0.22, 0.11, 0.30) * violetDiffuse;
        return (plateAlbedo * directLight + bounceLight) * ambientOcclusion;
    }

    if (keysHit <= minimumPartDistance + 0.02) {
        vec3 viewDirection = -worldRayDirection;
        float normalDotView = max(0.0, dot(worldNormal, viewDirection));
        float fresnelFactor = pow(1.0 - normalDotView, 3.0);
        vec3 keycapAlbedo = vec3(0.34, 0.35, 0.39);
        float directLight = 0.28 + 0.62 * topDiffuse;
        vec3 bounceLight = vec3(0.09, 0.36, 0.24) * mintDiffuse
            + vec3(0.26, 0.12, 0.36) * violetDiffuse;
        return (
            keycapAlbedo * directLight
            + bounceLight
            + vec3(0.08) * fresnelFactor
        ) * ambientOcclusion;
    }

    float topCapMask = smoothstep(0.72, 0.94, localNormal.z);
    vec3 reflectedRay = reflect(worldRayDirection, worldNormal);
    float softboxReflection = smoothstep(
        0.18,
        0.84,
        reflectedRay.y * 0.58 - reflectedRay.z * 0.74
    );
    float horizonReflection = smoothstep(-0.40, 0.25, -reflectedRay.z);
    float mintSpecular =
        pow(max(0.0, dot(reflectedRay, mintLightDirection)), 7.0);
    float violetSpecular =
        pow(max(0.0, dot(reflectedRay, violetLightDirection)), 7.0);

    vec3 satinTop = vec3(0.75, 0.77, 0.80) * (0.50 + 0.52 * topDiffuse)
        + vec3(0.06, 0.15, 0.11) * mintDiffuse
        + vec3(0.11, 0.06, 0.15) * violetDiffuse;
    float chromeBase =
        0.30 + 0.30 * horizonReflection + 0.48 * softboxReflection;
    vec3 flutedChrome = vec3(chromeBase)
        + vec3(0.26, 0.74, 0.56) * mintSpecular
        + vec3(0.62, 0.32, 0.82) * violetSpecular;
    return mix(flutedChrome, satinTop, topCapMask) * ambientOcclusion;
}

void main() {
    if (u_keypad[1].w <= 0.5) {
        discard;
    }
    float pixelX = gl_FragCoord.x / u_device_pixel_ratio;
    float pixelY = u_resolution.y - gl_FragCoord.y / u_device_pixel_ratio;
    vec2 pixelPosition = vec2(pixelX, pixelY);
    float halfHeight = max(u_resolution.y * 0.5, 1.0);

    float horizontalTangent =
        ((pixelPosition.x - u_resolution.x * 0.5) / halfHeight)
        * u_camera[0].w;
    float verticalTangent =
        ((u_resolution.y * 0.5 - pixelPosition.y) / halfHeight)
        * u_camera[0].w;
    vec3 cameraPosition = u_camera[0].xyz;
    vec3 worldRayDirection = normalize(
        u_camera[1].xyz
        + horizontalTangent * u_camera[2].xyz
        + verticalTangent * u_camera[3].xyz
    );

    vec3 keypadCenter = u_keypad[0].xyz;
    float millimetersPerUnit = max(u_keypad[0].w, 1.0);
    vec3 localAxisX = u_keypad[1].xyz;
    vec3 localAxisY = u_keypad[2].xyz;
    float hoverIntensity = u_keypad[2].w;
    vec3 localAxisZ = u_keypad[3].xyz;
    float keypadVisibility = u_keypad[3].w;

    vec3 relativeOrigin = (cameraPosition - keypadCenter) * millimetersPerUnit;
    vec3 localOrigin = vec3(
        dot(relativeOrigin, localAxisX),
        dot(relativeOrigin, localAxisY),
        dot(relativeOrigin, localAxisZ) + 6.0
    );
    vec3 localDirection = vec3(
        dot(worldRayDirection, localAxisX),
        dot(worldRayDirection, localAxisY),
        dot(worldRayDirection, localAxisZ)
    );

    vec3 boundsMinimum = vec3(-74.0, -74.0, -9.0);
    vec3 boundsMaximum = vec3(74.0, 74.0, 30.0);
    vec3 inverseDirection = 1.0 / (localDirection + vec3(1e-7));
    vec3 planeNear = (boundsMinimum - localOrigin) * inverseDirection;
    vec3 planeFar = (boundsMaximum - localOrigin) * inverseDirection;
    vec3 smallerPlanes = min(planeNear, planeFar);
    vec3 largerPlanes = max(planeNear, planeFar);
    float entryDistance = max(
        max(smallerPlanes.x, smallerPlanes.y),
        max(smallerPlanes.z, 0.0)
    );
    float exitDistance = min(
        min(largerPlanes.x, largerPlanes.y),
        largerPlanes.z
    );
    if (entryDistance >= exitDistance) {
        discard;
    }

    float marchDistance = entryDistance;
    bool didHitSurface = false;
    float closestBezelDistance = 999.0;
    float closestBezelMarch = entryDistance;
    vec3 hitPoint = localOrigin;
    vec3 localNormal = vec3(0.0);
    vec4 hitPartDistances = vec4(0.0);
    float occlusionSampleNear = 0.9;
    float occlusionSampleFar = 2.6;
    int evaluationPhase = 0;
    int subSampleIndex = 0;

    for (int iteration = u_zero; iteration < 42; iteration++) {
        vec3 samplePoint = localOrigin + localDirection * marchDistance;
        vec3 tetrahedronOffset = vec3(0.0);
        if (evaluationPhase == 1) {
            vec3 cornerBits = vec3(
                float(((subSampleIndex + 3) >> 1) & 1),
                float((subSampleIndex >> 1) & 1),
                float(subSampleIndex & 1)
            );
            tetrahedronOffset = 0.5773503 * (2.0 * cornerBits - 1.0);
            samplePoint = hitPoint + tetrahedronOffset * 0.06;
        }
        if (evaluationPhase == 2) {
            float occlusionStep = (subSampleIndex == 0) ? 0.9 : 2.6;
            samplePoint = hitPoint + localNormal * occlusionStep;
        }

        vec4 partDistances = evaluateKeypadDistances(samplePoint);
        float sceneDistance = min(
            min(partDistances.x, partDistances.y),
            min(partDistances.z, partDistances.w)
        );

        bool closerBezel =
            (evaluationPhase == 0) && (partDistances.x < closestBezelDistance);
        closestBezelDistance =
            closerBezel ? partDistances.x : closestBezelDistance;
        closestBezelMarch = closerBezel ? marchDistance : closestBezelMarch;

        if (evaluationPhase == 0 && sceneDistance < 0.085) {
            didHitSurface = true;
            hitPoint = samplePoint;
            hitPartDistances = partDistances;
            evaluationPhase = 1;
            subSampleIndex = 0;
            continue;
        }
        bool pastExit =
            marchDistance + sceneDistance > exitDistance || iteration >= 33;
        if (evaluationPhase == 0 && pastExit) {
            break;
        }
        if (evaluationPhase == 0) {
            marchDistance += sceneDistance;
            continue;
        }
        if (evaluationPhase == 1 && subSampleIndex < 3) {
            localNormal += tetrahedronOffset * sceneDistance;
            subSampleIndex++;
            continue;
        }
        if (evaluationPhase == 1) {
            localNormal += tetrahedronOffset * sceneDistance;
            localNormal /= max(length(localNormal), 1e-5);
            evaluationPhase = 2;
            subSampleIndex = 0;
            continue;
        }
        if (subSampleIndex == 0) {
            occlusionSampleNear = sceneDistance;
            subSampleIndex = 1;
            continue;
        }
        occlusionSampleFar = sceneDistance;
        break;
    }

    if (!didHitSurface && closestBezelDistance >= 14.0) {
        discard;
    }
    if (!didHitSurface) {
        vec3 worldClosest = cameraPosition
            + worldRayDirection * (closestBezelMarch / millimetersPerUnit)
            - keypadCenter;
        float haloGradient = clamp(
            (worldClosest.x * 0.82 - worldClosest.y * 0.32) * 0.62 + 0.5,
            0.0,
            1.0
        );
        vec3 haloColor = evaluateBezelPalette(haloGradient);
        float haloFalloff = exp(-max(0.0, closestBezelDistance) * 0.28)
            * (0.36 + hoverIntensity * 0.14);
        outColor = vec4(haloColor * haloFalloff * keypadVisibility, 0.0);
        return;
    }

    float ambientOcclusion = clamp(
        1.0
        - (0.9 - occlusionSampleNear) * 0.46
        - (2.6 - occlusionSampleFar) * 0.15,
        0.16,
        1.0
    );

    vec3 worldNormal = normalize(
        localAxisX * localNormal.x
        + localAxisY * localNormal.y
        + localAxisZ * localNormal.z
    );

    vec3 worldHitOffset = cameraPosition
        + worldRayDirection * (marchDistance / millimetersPerUnit)
        - keypadCenter;
    float bezelGradient = clamp(
        (worldHitOffset.x * 0.82 - worldHitOffset.y * 0.32) * 0.62 + 0.5,
        0.0,
        1.0
    );
    vec3 bezelHue = evaluateBezelPalette(bezelGradient);

    vec3 surfaceColor = shadeKeypadSurface(
        hitPoint,
        localNormal,
        worldNormal,
        worldRayDirection,
        hitPartDistances,
        bezelHue,
        hoverIntensity,
        ambientOcclusion
    );

    float bezelEdge = clamp((0.18 - closestBezelDistance) * 5.5, 0.88, 1.0);
    float edgeAlpha = keypadVisibility * bezelEdge;
    outColor = vec4(surfaceColor * edgeAlpha, edgeAlpha);
}
`;

export function projectKeypadQuad(
    viewportWidth,
    viewportHeight,
    cameraBuffer,
    keypadBuffer
) {
    const offsetX = keypadBuffer[0] - cameraBuffer[0];
    const offsetY = keypadBuffer[1] - cameraBuffer[1];
    const offsetZ = keypadBuffer[2] - cameraBuffer[2];
    const cameraSpaceX =
        offsetX * cameraBuffer[8]
        + offsetY * cameraBuffer[9]
        + offsetZ * cameraBuffer[10];
    const cameraSpaceY =
        offsetX * cameraBuffer[12]
        + offsetY * cameraBuffer[13]
        + offsetZ * cameraBuffer[14];
    const cameraSpaceZ = Math.max(
        1.0,
        offsetX * cameraBuffer[4]
        + offsetY * cameraBuffer[5]
        + offsetZ * cameraBuffer[6]
    );
    const focalLength =
        (viewportHeight * 0.5) / Math.max(0.1, cameraBuffer[3]);
    const projectionScale = focalLength / cameraSpaceZ;
    const screenX = viewportWidth * 0.5 + cameraSpaceX * projectionScale;
    const screenY = viewportHeight * 0.5 - cameraSpaceY * projectionScale;
    const millimetersPerUnit = Math.max(1.0, keypadBuffer[3]);
    const halfExtentPixels = Math.min(
        Math.max(viewportWidth, viewportHeight),
        (114.0 / millimetersPerUnit) * projectionScale * 1.24
    );
    return [screenX, screenY, halfExtentPixels, halfExtentPixels];
}
