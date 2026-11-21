import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const NEBULA_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    float skyMask = smoothstep(-0.04, 0.14, elevation);
    vec2 centeredDome = rotatedXz / (max(elevation, 0.0) + 0.42);

    vec3 horizonColor = vec3(0.1686, 0.172, 0.192);
    vec3 midSkyColor = vec3(0.068, 0.082, 0.138);
    vec3 zenithColor = vec3(0.032, 0.038, 0.074);
    float upperBlend = smoothstep(0.0, 0.68, max(elevation, 0.0));
    vec3 baseSky = mix(midSkyColor, zenithColor, upperBlend);
    vec3 skyColor = mix(
        horizonColor,
        baseSky,
        smoothstep(-0.03, 0.18, elevation)
    );

    mat2 octaveRot = mat2(0.8, -0.6, 0.6, 0.8);
    vec2 driftUv =
        seededDomeUv * 1.45 + vec2(u_time * 0.008, -u_time * 0.005);
    vec3 octaves = evaluateFbmOctaves3(
        driftUv,
        octaveRot,
        vec2(4.2, 1.7),
        vec2(-u_time * 0.012, -2.3)
    );
    vec3 octaveWeights = vec3(0.52, 0.31, 0.17);
    float nebulaField = dot(octaves, octaveWeights);

    float bandAxis =
        centeredDome.x * 0.55 - centeredDome.y * 0.32 + u_sky_seed.w * 0.18;
    float band = exp(-bandAxis * bandAxis * 2.4);
    float nebulaStrength =
        smoothstep(0.38, 0.82, nebulaField) * band * skyMask;
    vec3 nebulaViolet = vec3(0.32, 0.16, 0.54);
    vec3 nebulaTeal = vec3(0.10, 0.36, 0.48);
    vec3 nebulaHue =
        mix(nebulaViolet, nebulaTeal, smoothstep(0.25, 0.75, octaves.y));
    skyColor += nebulaHue * nebulaStrength * 0.42;

    float starsNear = evaluateSphericalStars(
        rayDir,
        u_sky_seed,
        38.0,
        0.86,
        92.0,
        2.1,
        u_time,
        vec2(0.0)
    );
    float starsFar = evaluateSphericalStars(
        rayDir,
        u_sky_seed,
        72.0,
        0.87,
        98.0,
        1.7,
        u_time + 5.0,
        vec2(3.7, 8.1)
    );
    vec3 coolStarColor = vec3(0.78, 0.86, 1.0);
    vec3 warmStarColor = vec3(1.0, 0.92, 0.84);
    vec3 starTint = mix(coolStarColor, warmStarColor, octaves.z);
    vec3 horizonHazeColor = vec3(0.035, 0.042, 0.068);
    skyColor += starTint * (starsNear + starsFar * 0.65) * 0.88;
    skyColor += horizonHazeColor * exp(-abs(elevation) * 14.0);

    outColor = vec4(skyColor, 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(NEBULA_MAIN_BODY);
