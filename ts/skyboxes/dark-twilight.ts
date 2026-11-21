import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const TWILIGHT_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    vec3 floorHorizon = vec3(0.1686, 0.165, 0.182);
    vec3 duskHorizon = vec3(0.295, 0.148, 0.245);
    vec3 duskMid = vec3(0.115, 0.088, 0.195);
    vec3 duskZenith = vec3(0.038, 0.045, 0.092);

    float lowBand = smoothstep(0.0, 0.22, max(elevation, 0.0));
    float highBand = smoothstep(0.16, 0.68, max(elevation, 0.0));
    vec3 upperDusk = mix(duskMid, duskZenith, highBand);
    vec3 twilightDome = mix(duskHorizon, upperDusk, lowBand);
    vec3 skyColor =
        mix(floorHorizon, twilightDome, smoothstep(-0.035, 0.07, elevation));

    vec3 sunDirection = normalize(vec3(sunAzimuthShift, 0.06, 0.95));
    float sunAlignment = max(0.0, dot(rayDir, sunDirection));
    float sunsetGlow =
        pow(sunAlignment, 5.0) * exp(-max(elevation, 0.0) * 5.5);
    float sunsetMask = smoothstep(-0.04, 0.04, elevation);
    vec3 sunsetBloomColor = vec3(0.38, 0.16, 0.22);
    skyColor += sunsetBloomColor * sunsetGlow * sunsetMask;

    vec2 cloudUv =
        vec2(seededDomeUv.x * 1.3 + u_time * 0.014, seededDomeUv.y * 2.6);
    float cloudBase = valueNoiseSimd(cloudUv);
    float cloudDetail =
        valueNoiseSimd(cloudUv * 2.3 - vec2(u_time * 0.02, 1.4));
    float cloudDensity =
        smoothstep(0.46, 0.80, cloudBase * 0.65 + cloudDetail * 0.35);
    float cloudHeight =
        smoothstep(0.02, 0.15, elevation) * (1.0 - highBand * 0.7);
    vec3 darkCloudBelly = vec3(0.065, 0.055, 0.11);
    vec3 litCloudEdge = vec3(0.36, 0.19, 0.31);
    vec3 cloudColor =
        mix(darkCloudBelly, litCloudEdge, smoothstep(0.3, 0.8, cloudDetail));
    skyColor = mix(skyColor, cloudColor, cloudDensity * cloudHeight * 0.52);

    float stars = evaluateSphericalStars(
        rayDir,
        u_sky_seed,
        48.0,
        0.90,
        102.0,
        1.6,
        u_time,
        vec2(6.4, 2.1)
    );
    float upperStarMask = smoothstep(0.16, 0.46, elevation);
    vec3 duskStarColor = vec3(0.90, 0.88, 1.0);
    skyColor += duskStarColor * stars * upperStarMask * 0.76;

    outColor = vec4(skyColor, 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(TWILIGHT_MAIN_BODY);
