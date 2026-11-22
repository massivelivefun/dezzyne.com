import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const DAWN_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    float skyMask = smoothstep(-0.02, 0.10, elevation);

    vec3 stageHorizon = vec3(0.845, 0.848, 0.870);
    vec3 dawnApricot = vec3(0.895, 0.695, 0.585);
    vec3 morningRose = vec3(0.695, 0.665, 0.815);
    vec3 morningBlue = vec3(0.395, 0.585, 0.845);

    float lowRise = smoothstep(0.0, 0.24, max(elevation, 0.0));
    float highRise = smoothstep(0.18, 0.68, max(elevation, 0.0));
    vec3 upperMorning = mix(morningRose, morningBlue, highRise);
    vec3 dawnGradient = mix(dawnApricot, upperMorning, lowRise);
    vec3 skyColor =
        mix(stageHorizon, dawnGradient, smoothstep(-0.035, 0.06, elevation));

    vec3 dawnSun = normalize(vec3(-sunAzimuthShift, 0.11, 0.95));
    float sunDot = max(0.0, dot(rayDir, dawnSun));
    float warmBloom = pow(sunDot, 6.0) * exp(-max(elevation, 0.0) * 3.8);
    vec3 warmSunTint = vec3(0.24, 0.14, 0.06);
    skyColor += warmSunTint * warmBloom * skyMask;

    vec2 strataUv = vec2(
        seededDomeUv.x * 1.35 - u_time * 0.012,
        seededDomeUv.y * 3.1 + u_time * 0.005
    );
    float cloud0 = valueNoiseSimd(strataUv);
    float cloud1 =
        valueNoiseSimd(strataUv * 2.25 + vec2(u_time * 0.015, 2.7));
    float cloudShape = smoothstep(0.45, 0.79, cloud0 * 0.62 + cloud1 * 0.38);
    float cloudFade = 1.0 - smoothstep(0.38, 0.78, elevation) * 0.55;
    vec3 cloudShadow = vec3(0.615, 0.625, 0.745);
    vec3 cloudGold = vec3(0.965, 0.865, 0.775);
    vec3 cloudTint =
        mix(cloudShadow, cloudGold, smoothstep(0.28, 0.76, cloud1));
    float cloudWeight = cloudShape * skyMask * cloudFade * 0.58;
    skyColor = mix(skyColor, cloudTint, cloudWeight);

    outColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(DAWN_MAIN_BODY);
