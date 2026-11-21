import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const AURORA_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    float skyMask = smoothstep(-0.03, 0.12, elevation);
    vec2 forwardDome = rayDir.xz / (max(elevation, 0.0) + 0.36);

    vec3 horizonColor = vec3(0.1686, 0.178, 0.188);
    vec3 nightMid = vec3(0.052, 0.078, 0.118);
    vec3 nightZenith = vec3(0.026, 0.042, 0.072);
    vec3 nightSky =
        mix(nightMid, nightZenith, smoothstep(0.0, 0.65, elevation));
    vec3 skyColor =
        mix(horizonColor, nightSky, smoothstep(-0.03, 0.16, elevation));

    float phaseShift = u_sky_seed.x * 0.37;
    float waveA =
        sin(forwardDome.x * 2.1 + phaseShift + u_time * 0.16) * 0.22;
    float waveB = valueNoiseSimd(
        vec2(seededDomeUv.x * 1.6 - u_time * 0.05, u_time * 0.04)
    );
    float ribbonCenter =
        waveA + (waveB - 0.5) * 0.48 + 0.38 + u_sky_seed.w * 0.14;
    float ribbonDist = forwardDome.y - ribbonCenter;

    float curtainFold = valueNoiseSimd(
        vec2(
            seededDomeUv.x * 7.5 + waveA * 3.0,
            elevation * 3.2 - u_time * 0.11
        )
    );
    float fineRays = valueNoiseSimd(
        vec2(seededDomeUv.x * 18.0 - u_time * 0.08, elevation * 4.5)
    );
    float curtainEnvelope = exp(-ribbonDist * ribbonDist * 5.2);
    float lowerFade = smoothstep(0.02, 0.16, elevation);
    float upperFade = 1.0 - smoothstep(0.32, 0.78, elevation);
    float foldGain = (0.45 + 0.55 * curtainFold) * (0.65 + 0.35 * fineRays);
    float auroraIntensity =
        curtainEnvelope * foldGain * lowerFade * upperFade * skyMask;

    vec3 auroraCyan = vec3(0.16, 0.68, 0.92);
    vec3 auroraViolet = vec3(0.52, 0.26, 0.88);
    vec3 emeraldGlow = vec3(0.14, 0.86, 0.58);
    vec3 cyanViolet = mix(auroraCyan, auroraViolet, waveB);
    vec3 auroraColor =
        mix(emeraldGlow, cyanViolet, smoothstep(0.06, 0.46, elevation));

    float stars = evaluateSphericalStars(
        rayDir,
        u_sky_seed,
        54.0,
        0.89,
        98.0,
        1.8,
        u_time,
        vec2(1.9, 4.3)
    );
    vec3 starTint = vec3(0.84, 0.92, 1.0);
    vec3 horizonGlowTint = vec3(0.03, 0.09, 0.08);
    skyColor += starTint * stars * 0.68;
    skyColor += auroraColor * auroraIntensity * 0.56;
    skyColor += horizonGlowTint * exp(-abs(elevation) * 13.0);

    outColor = vec4(skyColor, 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(AURORA_MAIN_BODY);
