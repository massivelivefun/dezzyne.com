import {
    asGlslSnippet,
    buildSkyboxFragmentShader,
    type GlslSnippet,
    type GlslSource,
} from "../shader-lib.ts";

const MIST_MAIN_BODY: GlslSnippet = asGlslSnippet(`
    float skyMask = smoothstep(-0.02, 0.12, elevation);

    vec3 floorHorizon = vec3(0.1686, 0.173, 0.184);
    vec3 horizonSilver = vec3(0.735, 0.785, 0.855);
    vec3 midSilver = vec3(0.585, 0.648, 0.745);
    vec3 zenithSlate = vec3(0.435, 0.508, 0.635);
    float lowMist = smoothstep(0.0, 0.22, max(elevation, 0.0));
    float zenithFactor = smoothstep(0.16, 0.70, max(elevation, 0.0));
    vec3 upperOvercast = mix(midSilver, zenithSlate, zenithFactor);
    vec3 mistDome = mix(horizonSilver, upperOvercast, lowMist);
    vec3 skyColor =
        mix(floorHorizon, mistDome, smoothstep(-0.035, 0.06, elevation));

    mat2 mistRotation = mat2(0.86, -0.51, 0.51, 0.86);
    vec2 mistUv0 =
        seededDomeUv * 1.1 + vec2(u_time * 0.011, -u_time * 0.007);
    vec3 mistLayers = evaluateFbmOctaves3(
        mistUv0,
        mistRotation,
        vec2(-u_time * 0.009, -2.2),
        vec2(4.1, 1.3)
    );
    vec3 mistWeights = vec3(0.52, 0.32, 0.16);
    float mistField = dot(mistLayers, mistWeights);
    float brightBreaks = smoothstep(0.44, 0.78, mistField) * skyMask;
    vec3 coolCloudColor = vec3(0.495, 0.558, 0.665);
    vec3 diffusedBreakColor = vec3(0.885, 0.918, 0.962);
    skyColor = mix(
        skyColor,
        coolCloudColor,
        (1.0 - mistField) * skyMask * 0.30
    );
    skyColor = mix(skyColor, diffusedBreakColor, brightBreaks * 0.52);

    outColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
`);

export const SKYBOX_FRAGMENT_SHADER_SOURCE: GlslSource =
    buildSkyboxFragmentShader(MIST_MAIN_BODY);
