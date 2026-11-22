import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const CIRRUS_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    float skyMask = smoothstep(-0.02, 0.14, elevation);

    vec3 floorHorizon = vec3(0.835, 0.850, 0.878);
    vec3 dayHorizon = vec3(0.685, 0.805, 0.945);
    vec3 midDayBlue = vec3(0.455, 0.655, 0.905);
    vec3 zenithAzure = vec3(0.285, 0.495, 0.815);
    float lowBlend = smoothstep(0.0, 0.24, max(elevation, 0.0));
    float heightBlend = smoothstep(0.16, 0.68, max(elevation, 0.0));
    vec3 upperSky = mix(midDayBlue, zenithAzure, heightBlend);
    vec3 dayDome = mix(dayHorizon, upperSky, lowBlend);
    vec3 skyColor =
        mix(floorHorizon, dayDome, smoothstep(-0.035, 0.06, elevation));

    vec3 sunDirection = normalize(vec3(sunAzimuthShift, 0.34, 0.86));
    float sunCosine = max(0.0, dot(rayDir, sunDirection));
    float solarHalo =
        pow(sunCosine, 9.0) * 0.16 + pow(sunCosine, 42.0) * 0.12;
    vec3 solarHaloColor = vec3(0.98, 0.97, 0.94);
    skyColor += solarHaloColor * solarHalo * skyMask;

    mat2 windRotation = mat2(0.92, -0.39, 0.39, 0.92);
    vec2 cirrusBaseUv = vec2(
        seededDomeUv.x * 1.15 + u_time * 0.015,
        seededDomeUv.y * 2.4 - u_time * 0.006
    );
    vec3 wisps = evaluateFbmOctaves3(
        cirrusBaseUv,
        windRotation,
        vec2(u_time * 0.01, 3.1),
        vec2(1.9, 5.4)
    );
    vec3 wispWeights = vec3(0.50, 0.33, 0.17);
    float cirrusField = dot(wisps, wispWeights);
    float wispHeight = skyMask * (0.35 + 0.65 * heightBlend);
    float cirrusWisps = smoothstep(0.48, 0.82, cirrusField) * wispHeight;
    vec3 cirrusShadowColor = vec3(0.665, 0.765, 0.905);
    vec3 cirrusCloudColor = vec3(0.945, 0.968, 1.0);
    vec3 sculptedCirrus = mix(
        cirrusShadowColor,
        cirrusCloudColor,
        smoothstep(0.32, 0.78, wisps.y)
    );
    skyColor = mix(skyColor, sculptedCirrus, cirrusWisps * 0.60);

    outColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(CIRRUS_MAIN_BODY);
