const {
    ArrayBuffer,
    Float32Array,
    Math,
    Number,
    Object,
    Uint8Array,
    Uint32Array,
    URL,
    WebAssembly,
} = globalThis;

const WASM_MODULE_URL = "/wasm/dezzyne_bg.wasm";
const MAXIMUM_WASM_BYTES = 65536;
const MAXIMUM_STAGE_DIMENSION = 8192;
const CAMERA_FLOATS = 20;
const KEYPAD_FLOATS = 16;
const MAXIMUM_PORTALS = 4;
const PORTAL_FLOATS = 12;
const RING_FLOATS_PER_PORTAL = 8;
const PARTICLE_FLOATS = 8;
const METADATA_U32S_PER_PORTAL = 4;
const MAJOR_GRID_STEP = 4.0;

const SCENE_GRID = 0;
const SCENE_PORTALS = 1;
const SCENE_KEYPAD = 2;

const WASM_FETCH_OPTIONS = Object.freeze({
    method: "GET",
    credentials: "same-origin",
    mode: "cors",
});

const WEBGL_CONTEXT_OPTIONS = Object.freeze({
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
});

const REQUIRED_FUNCTION_EXPORTS = Object.freeze([
    "initialize_scene",
    "resize_scene",
    "pointer_move",
    "pointer_leave",
    "click_stage",
    "is_interactive_hovered",
    "step_scene",
    "get_camera_pointer",
    "get_keypad_pointer",
    "get_portal_count",
    "get_portals_pointer",
    "get_rings_pointer",
    "get_particles_pointer",
    "get_particle_count",
    "get_portal_metadata_pointer",
]);

function hasValidWasmHeader(byteBuffer) {
    if (!(byteBuffer instanceof ArrayBuffer)) {
        return false;
    }
    const byteLength = byteBuffer.byteLength;
    if (byteLength < 8 || byteLength > MAXIMUM_WASM_BYTES) {
        return false;
    }
    const headerBytes = new Uint8Array(byteBuffer, 0, 8);
    return (
        headerBytes[0] === 0x00 &&
        headerBytes[1] === 0x61 &&
        headerBytes[2] === 0x73 &&
        headerBytes[3] === 0x6d &&
        headerBytes[4] === 0x01 &&
        headerBytes[5] === 0x00 &&
        headerBytes[6] === 0x00 &&
        headerBytes[7] === 0x00
    );
}

function isValidContentLengthHeader(contentLengthHeader) {
    if (contentLengthHeader === null) {
        return true;
    }
    const declaredLength = Number(contentLengthHeader);
    return (
        Number.isFinite(declaredLength) &&
        declaredLength >= 8 &&
        declaredLength <= MAXIMUM_WASM_BYTES
    );
}

function verifyWasmExports(wasmInstance) {
    const wasmExports = wasmInstance?.exports;
    if (!wasmExports || !(wasmExports.memory instanceof WebAssembly.Memory)) {
        return null;
    }
    for (
        let exportIndex = 0;
        exportIndex < REQUIRED_FUNCTION_EXPORTS.length;
        exportIndex++
    ) {
        const exportName = REQUIRED_FUNCTION_EXPORTS[exportIndex];
        if (typeof wasmExports[exportName] !== "function") {
            return null;
        }
    }
    return wasmExports;
}

async function loadVerifiedWasm() {
    if (typeof WebAssembly !== "object" || WebAssembly === null) {
        return null;
    }

    const response = await fetch(WASM_MODULE_URL, WASM_FETCH_OPTIONS);
    const validResponseType =
        response.type === "basic" || response.type === "cors";
    if (
        !response.ok ||
        response.status !== 200 ||
        response.redirected ||
        !validResponseType
    ) {
        return null;
    }

    const responseUrl = new URL(response.url, window.location.origin);
    if (responseUrl.origin !== window.location.origin) {
        return null;
    }
    if (responseUrl.pathname !== WASM_MODULE_URL) {
        return null;
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (!isValidContentLengthHeader(contentLengthHeader)) {
        return null;
    }

    const rawContentType = response.headers.get("content-type") || "";
    const contentType = rawContentType.toLowerCase();
    const isWasmMime = contentType.startsWith("application/wasm");
    const isOctetMime = contentType.startsWith("application/octet-stream");
    if (contentType && !isWasmMime && !isOctetMime) {
        return null;
    }

    const emptyImports = Object.create(null);
    if (isWasmMime && typeof WebAssembly.instantiateStreaming === "function") {
        const { instance } = await WebAssembly.instantiateStreaming(
            response,
            emptyImports
        );
        return verifyWasmExports(instance);
    }

    const wasmBytes = await response.arrayBuffer();
    if (!hasValidWasmHeader(wasmBytes)) {
        return null;
    }
    const { instance } = await WebAssembly.instantiate(
        wasmBytes,
        emptyImports
    );
    return verifyWasmExports(instance);
}

const INITIAL_WASM_PROMISE = loadVerifiedWasm().catch(() => null);

const FULLSCREEN_TRIANGLE_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const BOUNDED_QUAD_VERTEX_SHADER = `#version 300 es
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
`;

function buildGridFragmentShader(sceneMode) {
    const hasPortals = sceneMode === SCENE_PORTALS;
    const hasKeypad = sceneMode === SCENE_KEYPAD;

    const portalDeclarations = hasPortals
        ? `uniform int u_portal_count;
uniform vec4 u_portals[12];
uniform vec4 u_rings[8];
float evaluatePortalRings(float radialDistance, vec4 radii, vec4 alphas) {
    vec4 radialDelta = radialDistance - radii;
    vec4 squaredDelta = radialDelta * radialDelta;
    vec4 ringProfile =
        exp(-squaredDelta * 34.0) + exp(-squaredDelta * 5.5) * 0.45;
    return dot(ringProfile, alphas);
}
`
        : "";

    const keypadDeclaration = hasKeypad
        ? "uniform vec4 u_keypad_floor;\n"
        : "";

    const portalLightingBody = hasPortals
        ? `    float ringDenominator = min(rayDirection.y, -0.006);
    float ringVisibility = smoothstep(-0.008, -0.028, rayDirection.y);
    for (int portalIndex = 0; portalIndex < u_portal_count; portalIndex++) {
        vec4 portalWorld = u_portals[portalIndex * 3 + 1];
        vec4 portalState = u_portals[portalIndex * 3 + 2];
        if (portalWorld.z <= 0.5) {
            continue;
        }
        float portalScale = max(portalState.z, 0.1);
        float floorDistance =
            length(floorWorldXz - portalWorld.xy) / portalScale;
        float floorGlow =
            exp(-floorDistance * floorDistance * 0.52)
            * portalState.y
            * floorMask;
        surfaceColor += vec3(0.04, 0.13, 0.28) * floorGlow;
        surfaceColor += vec3(0.16, 0.54, 1.00)
            * max(minorLine, majorLine)
            * floorGlow
            * 0.55;

        float ringIntersectionDistance =
            (portalWorld.w - cameraPosition.y) / ringDenominator;
        vec2 ringPlaneXz =
            cameraPosition.xz + rayDirection.xz * ringIntersectionDistance;
        float ringRadialDistance =
            length(ringPlaneXz - portalWorld.xy) / portalScale;
        vec4 ringPair0 = u_rings[portalIndex * 2];
        vec4 ringPair1 = u_rings[portalIndex * 2 + 1];
        vec4 ringRadii = vec4(ringPair0.xz, ringPair1.xz) / portalScale;
        vec4 rawAlphas = vec4(ringPair0.yw, ringPair1.yw);
        vec4 ringAlphas = step(vec4(0.001), rawAlphas) * rawAlphas;
        float ringSum =
            evaluatePortalRings(ringRadialDistance, ringRadii, ringAlphas);
        surfaceColor += vec3(0.18, 0.60, 1.00)
            * min(ringSum, 2.2)
            * ringVisibility
            * 0.92;
    }
`
        : "";

    const keypadLightingBody = hasKeypad
        ? `    if (u_keypad_floor.z > 0.001) {
        vec2 floorOffset = floorWorldXz - u_keypad_floor.xy;
        float floorDistance = length(floorOffset);
        float lightPool = exp(-floorDistance * floorDistance * 0.42)
            * floorMask
            * u_keypad_floor.z;
        float tintGradient = clamp(floorOffset.x * 0.42 + 0.5, 0.0, 1.0);
        vec3 floorTint = mix(
            vec3(0.24, 0.88, 0.72),
            vec3(0.72, 0.40, 0.96),
            tintGradient
        );
        float hoverBoost = 1.0 + u_keypad_floor.w * 0.28;
        surfaceColor += floorTint * lightPool * 0.09 * hoverBoost;
        surfaceColor += floorTint
            * max(minorLine, majorLine)
            * lightPool
            * 0.36
            * hoverBoost;
    }
`
        : "";

    return `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_device_pixel_ratio;
uniform vec4 u_camera[5];
${portalDeclarations}${keypadDeclaration}
out vec4 outColor;

vec2 evaluateGridAxis(
    vec2 gridCoord,
    vec2 derivativeWidth,
    float radiusPixels
) {
    vec2 lineCoverage = clamp(1.0 - derivativeWidth * 1.15, 0.0, 1.0);
    vec2 distancePixels =
        abs(fract(gridCoord - 0.5) - 0.5) / max(derivativeWidth, vec2(1e-4));
    vec2 smoothEdge =
        smoothstep(radiusPixels - 0.55, radiusPixels + 0.55, distancePixels);
    return (1.0 - smoothEdge) * lineCoverage;
}

void main() {
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
    vec3 unnormalizedRay = u_camera[1].xyz
        + horizontalTangent * u_camera[2].xyz
        + verticalTangent * u_camera[3].xyz;
    vec3 rayDirection = normalize(unnormalizedRay);
    float scrollOffsetZ = u_camera[1].w;

    vec3 surfaceColor = vec3(0.1686);
    vec2 centeredUv = (pixelPosition / u_resolution) - 0.5;
    surfaceColor -= dot(centeredUv, centeredUv) * 0.032;
    float horizonGlow = exp(-abs(rayDirection.y) * 16.0);
    surfaceColor += vec3(0.022, 0.023, 0.025) * horizonGlow;

    float floorDenominator = min(rayDirection.y, -0.012);
    float floorIntersectionDistance =
        (u_camera[2].w - cameraPosition.y) / floorDenominator;
    vec2 floorWorldXz =
        cameraPosition.xz + rayDirection.xz * floorIntersectionDistance;
    vec2 scrolledFloorXz = floorWorldXz + vec2(0.0, scrollOffsetZ);
    vec2 floorDerivative = fwidth(scrolledFloorXz);

    float floorMask = smoothstep(-0.014, -0.055, rayDirection.y);
    float minorVisibility =
        floorMask * exp(-floorIntersectionDistance * 0.095);
    float majorVisibility =
        floorMask * exp(-floorIntersectionDistance * 0.055);

    surfaceColor -=
        vec3(0.015) * floorMask * exp(-floorIntersectionDistance * 0.14);

    vec2 minorAxes = evaluateGridAxis(scrolledFloorXz, floorDerivative, 0.45);
    vec2 majorAxes = evaluateGridAxis(
        scrolledFloorXz * 0.25,
        floorDerivative * 0.25,
        0.72
    );
    float minorLine = max(minorAxes.x, minorAxes.y);
    float majorLine = max(majorAxes.x, majorAxes.y);
    float majorIntersection = majorAxes.x * majorAxes.y;

    float cursorDistance = length(floorWorldXz - u_camera[4].xy);
    float spotlightFalloff = exp(-cursorDistance * cursorDistance * 0.11);
    float cursorSpotlight = spotlightFalloff * u_camera[4].w * floorMask;

    float gridLuminance = minorLine * 0.055 * minorVisibility
        + majorLine * 0.135 * majorVisibility
        + majorIntersection * 0.075 * majorVisibility
        + max(minorLine, majorLine) * 0.19 * cursorSpotlight
        + 0.020 * cursorSpotlight;
    surfaceColor += vec3(gridLuminance);

${portalLightingBody}${keypadLightingBody}
    outColor = vec4(surfaceColor, 1.0);
}
`;
}

function readFloat32View(wasmMemory, byteOffset, elementCount) {
    if (elementCount === 0) {
        return new Float32Array(0);
    }
    if (
        !Number.isInteger(byteOffset) ||
        byteOffset < 0 ||
        (byteOffset & 3) !== 0
    ) {
        return null;
    }
    const memoryBuffer = wasmMemory.buffer;
    const byteLength = elementCount * 4;
    if (byteOffset + byteLength > memoryBuffer.byteLength) {
        return null;
    }
    return new Float32Array(memoryBuffer, byteOffset, elementCount);
}

function readUint32View(wasmMemory, byteOffset, elementCount) {
    if (elementCount === 0) {
        return new Uint32Array(0);
    }
    if (
        !Number.isInteger(byteOffset) ||
        byteOffset < 0 ||
        (byteOffset & 3) !== 0
    ) {
        return null;
    }
    const memoryBuffer = wasmMemory.buffer;
    const byteLength = elementCount * 4;
    if (byteOffset + byteLength > memoryBuffer.byteLength) {
        return null;
    }
    return new Uint32Array(memoryBuffer, byteOffset, elementCount);
}

function deleteShaderIfPresent(glContext, shader) {
    if (!shader) {
        return;
    }
    glContext.deleteShader(shader);
}

function compileShaderSynchronously(glContext, shaderType, shaderSource) {
    const shader = glContext.createShader(shaderType);
    if (!shader) {
        return null;
    }
    glContext.shaderSource(shader, shaderSource);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        glContext.deleteShader(shader);
        return null;
    }
    return shader;
}

function buildProgramSynchronously(
    glContext,
    vertexShaderSource,
    fragmentShaderSource
) {
    const vertexShader = compileShaderSynchronously(
        glContext,
        glContext.VERTEX_SHADER,
        vertexShaderSource
    );
    const fragmentShader = compileShaderSynchronously(
        glContext,
        glContext.FRAGMENT_SHADER,
        fragmentShaderSource
    );
    if (!vertexShader || !fragmentShader) {
        deleteShaderIfPresent(glContext, vertexShader);
        deleteShaderIfPresent(glContext, fragmentShader);
        return null;
    }
    const shaderProgram = glContext.createProgram();
    if (!shaderProgram) {
        glContext.deleteShader(vertexShader);
        glContext.deleteShader(fragmentShader);
        return null;
    }
    glContext.attachShader(shaderProgram, vertexShader);
    glContext.attachShader(shaderProgram, fragmentShader);
    glContext.linkProgram(shaderProgram);
    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);
    if (!glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS)) {
        glContext.deleteProgram(shaderProgram);
        return null;
    }
    return shaderProgram;
}

function isProgramCompileCompleted(
    glContext,
    parallelCompileExtension,
    shaderProgram
) {
    if (!parallelCompileExtension) {
        return true;
    }
    return Boolean(
        glContext.getProgramParameter(
            shaderProgram,
            parallelCompileExtension.COMPLETION_STATUS_KHR
        )
    );
}

function startAsynchronousProgram(
    glContext,
    parallelCompileExtension,
    vertexShaderSource,
    fragmentShaderSource,
    onProgramLinked
) {
    const vertexShader = glContext.createShader(glContext.VERTEX_SHADER);
    const fragmentShader = glContext.createShader(glContext.FRAGMENT_SHADER);
    const shaderProgram = glContext.createProgram();
    if (!vertexShader || !fragmentShader || !shaderProgram) {
        return {
            poll() {
                return false;
            },
            dispose() {},
        };
    }

    glContext.shaderSource(vertexShader, vertexShaderSource);
    glContext.compileShader(vertexShader);
    glContext.shaderSource(fragmentShader, fragmentShaderSource);
    glContext.compileShader(fragmentShader);
    glContext.attachShader(shaderProgram, vertexShader);
    glContext.attachShader(shaderProgram, fragmentShader);
    glContext.linkProgram(shaderProgram);

    let isCompleted = false;

    return {
        poll() {
            if (isCompleted) {
                return false;
            }
            const ready = isProgramCompileCompleted(
                glContext,
                parallelCompileExtension,
                shaderProgram
            );
            if (!ready) {
                return false;
            }

            isCompleted = true;
            glContext.deleteShader(vertexShader);
            glContext.deleteShader(fragmentShader);
            const isLinked = glContext.getProgramParameter(
                shaderProgram,
                glContext.LINK_STATUS
            );
            if (!isLinked) {
                glContext.deleteProgram(shaderProgram);
                return false;
            }
            onProgramLinked(shaderProgram);
            return true;
        },
        dispose() {
            if (!isCompleted) {
                isCompleted = true;
                glContext.deleteShader(vertexShader);
                glContext.deleteShader(fragmentShader);
            }
            glContext.deleteProgram(shaderProgram);
        },
    };
}

function applyFallbackWideFraming(
    cameraBuffer,
    viewportWidth,
    viewportHeight
) {
    const safeWidth = Math.max(1, viewportWidth);
    const safeHeight = Math.max(1, viewportHeight);
    const aspectRatio = safeWidth / safeHeight;
    const aspectWideness = Math.min(
        1,
        Math.max(0, (aspectRatio - 2.35) / 1.45)
    );
    const shortHeightFactor = Math.min(
        1,
        Math.max(0, (440 - safeHeight) / 180)
    );
    const landscapeGate = Math.min(1, Math.max(0, (aspectRatio - 1.4) / 0.6));
    const wideFraming = Math.max(
        aspectWideness,
        shortHeightFactor * landscapeGate
    );
    const initialPitch = -0.14 + wideFraming * 0.042;
    const pitchSine = Math.sin(initialPitch);
    const pitchCosine = Math.cos(initialPitch);
    cameraBuffer[3] = 0.58 - wideFraming * 0.2;
    cameraBuffer[5] = pitchSine;
    cameraBuffer[6] = pitchCosine;
    cameraBuffer[13] = pitchCosine;
    cameraBuffer[14] = -pitchSine;
}

function createInitialCameraBuffer() {
    const cameraBuffer = new Float32Array(CAMERA_FLOATS);
    cameraBuffer[8] = 1.0;
    cameraBuffer[11] = -1.55;
    cameraBuffer[17] = 8.0;
    cameraBuffer[18] = -1.0;
    applyFallbackWideFraming(cameraBuffer, 1280, 720);
    return cameraBuffer;
}

function createStageRenderer(stage, sceneMode) {
    const glContext = stage.getContext("webgl2", WEBGL_CONTEXT_OPTIONS);
    if (!glContext) {
        return null;
    }

    const parallelCompileExtension = glContext.getExtension(
        "KHR_parallel_shader_compile"
    );
    const gridProgram = buildProgramSynchronously(
        glContext,
        FULLSCREEN_TRIANGLE_VERTEX_SHADER,
        buildGridFragmentShader(sceneMode)
    );
    if (!gridProgram) {
        return null;
    }

    const gridVertexArray = glContext.createVertexArray();
    const triangleBuffer = glContext.createBuffer();
    const quadBuffer = glContext.createBuffer();
    if (!gridVertexArray || !triangleBuffer || !quadBuffer) {
        return null;
    }

    glContext.bindVertexArray(gridVertexArray);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, triangleBuffer);
    glContext.bufferData(
        glContext.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        glContext.STATIC_DRAW
    );
    const gridPositionLocation = glContext.getAttribLocation(
        gridProgram,
        "a_position"
    );
    if (gridPositionLocation < 0) {
        return null;
    }
    glContext.enableVertexAttribArray(gridPositionLocation);
    glContext.vertexAttribPointer(
        gridPositionLocation,
        2,
        glContext.FLOAT,
        false,
        0,
        0
    );

    glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
    glContext.bufferData(
        glContext.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        glContext.STATIC_DRAW
    );

    const gridUniforms = Object.assign(Object.create(null), {
        resolution: glContext.getUniformLocation(gridProgram, "u_resolution"),
        devicePixelRatio: glContext.getUniformLocation(
            gridProgram,
            "u_device_pixel_ratio"
        ),
        camera: glContext.getUniformLocation(gridProgram, "u_camera[0]"),
        portalCount: glContext.getUniformLocation(
            gridProgram,
            "u_portal_count"
        ),
        portals: glContext.getUniformLocation(gridProgram, "u_portals[0]"),
        rings: glContext.getUniformLocation(gridProgram, "u_rings[0]"),
        keypadFloor: glContext.getUniformLocation(
            gridProgram,
            "u_keypad_floor"
        ),
    });

    const paddedPortals = new Float32Array(MAXIMUM_PORTALS * PORTAL_FLOATS);
    const paddedRings = new Float32Array(
        MAXIMUM_PORTALS * RING_FLOATS_PER_PORTAL
    );
    const asynchronousJobs = [];

    let keypadProgram = null;
    let keypadVertexArray = null;
    let keypadUniforms = null;
    let projectKeypadQuadFunction = null;

    let portalProgram = null;
    let portalVertexArray = null;
    let portalUniforms = null;

    let particleProgram = null;
    let particleVertexArray = null;
    let instanceBuffer = null;
    let instanceCapacity = 0;
    let particleResolutionLocation = null;

    let labelProgram = null;
    let labelVertexArray = null;
    let labelUniforms = null;
    let labelManager = null;

    function bindUnitQuadVertexArray(shaderProgram) {
        const vertexArray = glContext.createVertexArray();
        if (!vertexArray) {
            return null;
        }
        glContext.bindVertexArray(vertexArray);
        glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
        const quadLocation = glContext.getAttribLocation(
            shaderProgram,
            "a_quad"
        );
        if (quadLocation < 0) {
            glContext.deleteVertexArray(vertexArray);
            return null;
        }
        glContext.enableVertexAttribArray(quadLocation);
        glContext.vertexAttribPointer(
            quadLocation,
            2,
            glContext.FLOAT,
            false,
            0,
            0
        );
        return vertexArray;
    }

    function renderKeypadPass(
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        cameraBuffer,
        keypadBuffer,
        isKeypadReady
    ) {
        if (!isKeypadReady) {
            return;
        }
        const boundsRect = projectKeypadQuadFunction(
            viewportWidth,
            viewportHeight,
            cameraBuffer,
            keypadBuffer
        );
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);
        glContext.useProgram(keypadProgram);
        glContext.bindVertexArray(keypadVertexArray);

        glContext.uniform2f(
            keypadUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1f(
            keypadUniforms.devicePixelRatio,
            devicePixelRatio
        );
        glContext.uniform4f(
            keypadUniforms.boundsRect,
            boundsRect[0],
            boundsRect[1],
            boundsRect[2],
            boundsRect[3]
        );
        glContext.uniform4fv(keypadUniforms.camera, cameraBuffer);
        glContext.uniform4fv(keypadUniforms.keypad, keypadBuffer);

        glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        glContext.disable(glContext.BLEND);
    }

    function renderPortalVortexQuads(
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        cameraBuffer,
        activePortalCount,
        portalsBuffer,
        ringsBuffer
    ) {
        glContext.useProgram(portalProgram);
        glContext.bindVertexArray(portalVertexArray);
        glContext.uniform2f(
            portalUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1f(portalUniforms.devicePixelRatio, devicePixelRatio);
        glContext.uniform4fv(portalUniforms.camera, cameraBuffer);

        for (
            let portalIndex = 0;
            portalIndex < activePortalCount;
            portalIndex++
        ) {
            const portalOffset = portalIndex * PORTAL_FLOATS;
            const ringOffset = portalIndex * RING_FLOATS_PER_PORTAL;
            const radiusX = portalsBuffer[portalOffset + 2];
            const radiusY = portalsBuffer[portalOffset + 3];
            if (radiusX <= 2.0 || radiusY <= 2.0) {
                continue;
            }
            const centerX = portalsBuffer[portalOffset];
            const centerY = portalsBuffer[portalOffset + 1];

            glContext.uniform4f(
                portalUniforms.boundsRect,
                centerX,
                centerY,
                radiusX * 1.38,
                radiusY * 1.38
            );
            glContext.uniform4fv(
                portalUniforms.portal,
                portalsBuffer.subarray(
                    portalOffset,
                    portalOffset + PORTAL_FLOATS
                )
            );
            glContext.uniform4fv(
                portalUniforms.rings,
                ringsBuffer.subarray(
                    ringOffset,
                    ringOffset + RING_FLOATS_PER_PORTAL
                )
            );
            glContext.uniform1f(
                portalUniforms.phaseOffset,
                portalIndex * 2.35
            );
            glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        }
    }

    function renderPortalParticles(
        viewportWidth,
        viewportHeight,
        particleCount,
        particlesBuffer
    ) {
        if (!particleProgram || particleCount <= 0 || !particlesBuffer) {
            return;
        }
        glContext.blendFunc(glContext.ONE, glContext.ONE);
        glContext.useProgram(particleProgram);
        glContext.bindVertexArray(particleVertexArray);
        glContext.uniform2f(
            particleResolutionLocation,
            viewportWidth,
            viewportHeight
        );

        glContext.bindBuffer(glContext.ARRAY_BUFFER, instanceBuffer);
        if (instanceCapacity < particleCount) {
            instanceCapacity = particleCount;
            glContext.bufferData(
                glContext.ARRAY_BUFFER,
                particlesBuffer.byteLength,
                glContext.DYNAMIC_DRAW
            );
        }
        glContext.bufferSubData(glContext.ARRAY_BUFFER, 0, particlesBuffer);
        glContext.drawArraysInstanced(
            glContext.TRIANGLES,
            0,
            6,
            particleCount
        );
    }

    function renderPortalLabels(
        viewportWidth,
        viewportHeight,
        portalCount,
        activePortalCount,
        portalsBuffer
    ) {
        if (
            !labelProgram ||
            !labelManager ||
            labelManager.slots.length < portalCount
        ) {
            return;
        }
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);
        glContext.useProgram(labelProgram);
        glContext.bindVertexArray(labelVertexArray);
        glContext.activeTexture(glContext.TEXTURE0);
        glContext.uniform2f(
            labelUniforms.resolution,
            viewportWidth,
            viewportHeight
        );
        glContext.uniform1i(labelUniforms.texture, 0);

        for (
            let portalIndex = 0;
            portalIndex < activePortalCount;
            portalIndex++
        ) {
            const labelSlot = labelManager.slots[portalIndex];
            if (!labelSlot || !labelSlot.isReady) {
                continue;
            }
            const portalOffset = portalIndex * PORTAL_FLOATS;
            const radiusY = portalsBuffer[portalOffset + 3];
            if (radiusY <= 2.0) {
                continue;
            }
            const centerX = portalsBuffer[portalOffset];
            const centerY = portalsBuffer[portalOffset + 1];
            const rawAlpha = portalsBuffer[portalOffset + 9];
            const clampedAlpha = Math.min(1, Math.max(0, rawAlpha));

            const halfHeight = radiusY * 0.68;
            const halfWidth = halfHeight * labelManager.aspectRatio;
            const labelCenterY = centerY - radiusY * 1.36;

            glContext.bindTexture(glContext.TEXTURE_2D, labelSlot.texture);
            glContext.uniform4f(
                labelUniforms.boundsRect,
                centerX,
                labelCenterY,
                halfWidth,
                halfHeight
            );
            glContext.uniform1f(labelUniforms.alpha, clampedAlpha);
            glContext.drawArrays(glContext.TRIANGLES, 0, 6);
        }
    }

    function renderPortalsPass(
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        cameraBuffer,
        portalCount,
        activePortalCount,
        portalsBuffer,
        ringsBuffer,
        particleCount,
        particlesBuffer
    ) {
        if (activePortalCount <= 0 || !portalsBuffer || !ringsBuffer) {
            return;
        }
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA);

        renderPortalVortexQuads(
            viewportWidth,
            viewportHeight,
            devicePixelRatio,
            cameraBuffer,
            activePortalCount,
            portalsBuffer,
            ringsBuffer
        );
        renderPortalParticles(
            viewportWidth,
            viewportHeight,
            particleCount,
            particlesBuffer
        );
        renderPortalLabels(
            viewportWidth,
            viewportHeight,
            portalCount,
            activePortalCount,
            portalsBuffer
        );

        glContext.disable(glContext.BLEND);
    }

    return {
        areEntitiesReady() {
            if (sceneMode === SCENE_KEYPAD) {
                return Boolean(keypadProgram);
            }
            if (sceneMode === SCENE_PORTALS) {
                return Boolean(portalProgram);
            }
            return true;
        },
        attachKeypadModule(keypadModule) {
            projectKeypadQuadFunction = keypadModule.projectKeypadQuad;
            asynchronousJobs.push(
                startAsynchronousProgram(
                    glContext,
                    parallelCompileExtension,
                    BOUNDED_QUAD_VERTEX_SHADER,
                    keypadModule.KEYPAD_FRAGMENT_SHADER_SOURCE,
                    (shaderProgram) => {
                        const vertexArray =
                            bindUnitQuadVertexArray(shaderProgram);
                        if (!vertexArray) {
                            return;
                        }
                        keypadProgram = shaderProgram;
                        keypadVertexArray = vertexArray;
                        keypadUniforms = Object.assign(Object.create(null), {
                            resolution: glContext.getUniformLocation(
                                shaderProgram,
                                "u_resolution"
                            ),
                            devicePixelRatio: glContext.getUniformLocation(
                                shaderProgram,
                                "u_device_pixel_ratio"
                            ),
                            zero: glContext.getUniformLocation(
                                shaderProgram,
                                "u_zero"
                            ),
                            boundsRect: glContext.getUniformLocation(
                                shaderProgram,
                                "u_bounds_rect"
                            ),
                            camera: glContext.getUniformLocation(
                                shaderProgram,
                                "u_camera[0]"
                            ),
                            keypad: glContext.getUniformLocation(
                                shaderProgram,
                                "u_keypad[0]"
                            ),
                        });
                        glContext.useProgram(shaderProgram);
                        glContext.uniform1i(keypadUniforms.zero, 0);
                    }
                )
            );
        },
        attachPortalsModule(portalsModule) {
            asynchronousJobs.push(
                startAsynchronousProgram(
                    glContext,
                    parallelCompileExtension,
                    BOUNDED_QUAD_VERTEX_SHADER,
                    portalsModule.PORTAL_FRAGMENT_SHADER_SOURCE,
                    (shaderProgram) => {
                        const vertexArray =
                            bindUnitQuadVertexArray(shaderProgram);
                        if (!vertexArray) {
                            return;
                        }
                        portalProgram = shaderProgram;
                        portalVertexArray = vertexArray;
                        portalUniforms = Object.assign(Object.create(null), {
                            resolution: glContext.getUniformLocation(
                                shaderProgram,
                                "u_resolution"
                            ),
                            devicePixelRatio: glContext.getUniformLocation(
                                shaderProgram,
                                "u_device_pixel_ratio"
                            ),
                            zero: glContext.getUniformLocation(
                                shaderProgram,
                                "u_zero"
                            ),
                            boundsRect: glContext.getUniformLocation(
                                shaderProgram,
                                "u_bounds_rect"
                            ),
                            camera: glContext.getUniformLocation(
                                shaderProgram,
                                "u_camera[0]"
                            ),
                            portal: glContext.getUniformLocation(
                                shaderProgram,
                                "u_portal[0]"
                            ),
                            rings: glContext.getUniformLocation(
                                shaderProgram,
                                "u_portal_rings[0]"
                            ),
                            phaseOffset: glContext.getUniformLocation(
                                shaderProgram,
                                "u_phase_offset"
                            ),
                        });
                        glContext.useProgram(shaderProgram);
                        glContext.uniform1i(portalUniforms.zero, 0);
                    }
                )
            );

            asynchronousJobs.push(
                startAsynchronousProgram(
                    glContext,
                    parallelCompileExtension,
                    portalsModule.PARTICLE_VERTEX_SHADER_SOURCE,
                    portalsModule.PARTICLE_FRAGMENT_SHADER_SOURCE,
                    (shaderProgram) => {
                        const vertexArray = glContext.createVertexArray();
                        const particleInstanceBuffer =
                            glContext.createBuffer();
                        if (!vertexArray || !particleInstanceBuffer) {
                            return;
                        }
                        glContext.bindVertexArray(vertexArray);
                        glContext.bindBuffer(
                            glContext.ARRAY_BUFFER,
                            quadBuffer
                        );
                        const quadLocation = glContext.getAttribLocation(
                            shaderProgram,
                            "a_quad"
                        );
                        const geometryLocation = glContext.getAttribLocation(
                            shaderProgram,
                            "a_particle_geometry"
                        );
                        const appearanceLocation = glContext.getAttribLocation(
                            shaderProgram,
                            "a_particle_appearance"
                        );
                        if (
                            quadLocation < 0 ||
                            geometryLocation < 0 ||
                            appearanceLocation < 0
                        ) {
                            return;
                        }
                        glContext.enableVertexAttribArray(quadLocation);
                        glContext.vertexAttribPointer(
                            quadLocation,
                            2,
                            glContext.FLOAT,
                            false,
                            0,
                            0
                        );

                        glContext.bindBuffer(
                            glContext.ARRAY_BUFFER,
                            particleInstanceBuffer
                        );
                        const byteStride = PARTICLE_FLOATS * 4;
                        glContext.enableVertexAttribArray(geometryLocation);
                        glContext.vertexAttribPointer(
                            geometryLocation,
                            4,
                            glContext.FLOAT,
                            false,
                            byteStride,
                            0
                        );
                        glContext.vertexAttribDivisor(geometryLocation, 1);

                        glContext.enableVertexAttribArray(appearanceLocation);
                        glContext.vertexAttribPointer(
                            appearanceLocation,
                            4,
                            glContext.FLOAT,
                            false,
                            byteStride,
                            16
                        );
                        glContext.vertexAttribDivisor(appearanceLocation, 1);

                        particleProgram = shaderProgram;
                        particleVertexArray = vertexArray;
                        instanceBuffer = particleInstanceBuffer;
                        particleResolutionLocation =
                            glContext.getUniformLocation(
                                shaderProgram,
                                "u_resolution"
                            );
                    }
                )
            );

            asynchronousJobs.push(
                startAsynchronousProgram(
                    glContext,
                    parallelCompileExtension,
                    BOUNDED_QUAD_VERTEX_SHADER,
                    portalsModule.LABEL_FRAGMENT_SHADER_SOURCE,
                    (shaderProgram) => {
                        const vertexArray =
                            bindUnitQuadVertexArray(shaderProgram);
                        const manager =
                            portalsModule.createLabelManager(glContext);
                        if (!vertexArray || !manager) {
                            return;
                        }
                        labelProgram = shaderProgram;
                        labelVertexArray = vertexArray;
                        labelManager = manager;
                        labelUniforms = Object.assign(Object.create(null), {
                            resolution: glContext.getUniformLocation(
                                shaderProgram,
                                "u_resolution"
                            ),
                            boundsRect: glContext.getUniformLocation(
                                shaderProgram,
                                "u_bounds_rect"
                            ),
                            texture: glContext.getUniformLocation(
                                shaderProgram,
                                "u_texture"
                            ),
                            alpha: glContext.getUniformLocation(
                                shaderProgram,
                                "u_alpha"
                            ),
                        });
                    }
                )
            );
        },
        pollAsynchronousJobs() {
            let linkedAnyProgram = false;
            for (
                let jobIndex = 0;
                jobIndex < asynchronousJobs.length;
                jobIndex++
            ) {
                if (asynchronousJobs[jobIndex].poll()) {
                    linkedAnyProgram = true;
                }
            }
            return linkedAnyProgram;
        },
        synchronizeLabels(portalCount, metadataView) {
            if (!labelManager) {
                return;
            }
            labelManager.synchronize(portalCount, metadataView);
        },
        render(
            viewportWidth,
            viewportHeight,
            devicePixelRatio,
            cameraBuffer,
            keypadBuffer,
            portalCount,
            portalsBuffer,
            ringsBuffer,
            particleCount,
            particlesBuffer
        ) {
            if (glContext.isContextLost()) {
                return false;
            }

            const activePortalCount = portalProgram ? portalCount : 0;
            if (activePortalCount > 0 && portalsBuffer && ringsBuffer) {
                paddedPortals.fill(0);
                paddedRings.fill(0);
                const portalFloatCount = activePortalCount * PORTAL_FLOATS;
                paddedPortals.set(
                    portalsBuffer.subarray(0, portalFloatCount)
                );
                const ringFloatCount =
                    activePortalCount * RING_FLOATS_PER_PORTAL;
                paddedRings.set(ringsBuffer.subarray(0, ringFloatCount));
            }

            const isKeypadReady = Boolean(
                keypadProgram &&
                    projectKeypadQuadFunction &&
                    keypadBuffer &&
                    keypadBuffer[7] > 0.5
            );

            glContext.viewport(0, 0, stage.width, stage.height);
            glContext.disable(glContext.BLEND);
            glContext.useProgram(gridProgram);
            glContext.bindVertexArray(gridVertexArray);

            glContext.uniform2f(
                gridUniforms.resolution,
                viewportWidth,
                viewportHeight
            );
            glContext.uniform1f(
                gridUniforms.devicePixelRatio,
                devicePixelRatio
            );
            glContext.uniform4fv(gridUniforms.camera, cameraBuffer);
            if (gridUniforms.portalCount !== null) {
                glContext.uniform1i(
                    gridUniforms.portalCount,
                    activePortalCount
                );
                glContext.uniform4fv(gridUniforms.portals, paddedPortals);
                glContext.uniform4fv(gridUniforms.rings, paddedRings);
            }
            if (gridUniforms.keypadFloor !== null) {
                glContext.uniform4f(
                    gridUniforms.keypadFloor,
                    isKeypadReady ? keypadBuffer[0] : 0.0,
                    isKeypadReady ? keypadBuffer[2] : 0.0,
                    isKeypadReady ? keypadBuffer[15] : 0.0,
                    isKeypadReady ? keypadBuffer[11] : 0.0
                );
            }

            glContext.drawArrays(glContext.TRIANGLES, 0, 3);

            renderKeypadPass(
                viewportWidth,
                viewportHeight,
                devicePixelRatio,
                cameraBuffer,
                keypadBuffer,
                isKeypadReady
            );
            renderPortalsPass(
                viewportWidth,
                viewportHeight,
                devicePixelRatio,
                cameraBuffer,
                portalCount,
                activePortalCount,
                portalsBuffer,
                ringsBuffer,
                particleCount,
                particlesBuffer
            );

            return true;
        },
        dispose() {
            try {
                if (labelManager) {
                    labelManager.dispose();
                }
                for (
                    let jobIndex = 0;
                    jobIndex < asynchronousJobs.length;
                    jobIndex++
                ) {
                    asynchronousJobs[jobIndex].dispose();
                }
                if (keypadVertexArray) {
                    glContext.deleteVertexArray(keypadVertexArray);
                }
                if (portalVertexArray) {
                    glContext.deleteVertexArray(portalVertexArray);
                }
                if (labelVertexArray) {
                    glContext.deleteVertexArray(labelVertexArray);
                }
                if (particleVertexArray) {
                    glContext.deleteVertexArray(particleVertexArray);
                }
                if (instanceBuffer) {
                    glContext.deleteBuffer(instanceBuffer);
                }
                glContext.deleteBuffer(quadBuffer);
                glContext.deleteBuffer(triangleBuffer);
                glContext.deleteVertexArray(gridVertexArray);
                glContext.deleteProgram(gridProgram);
                const loseContextExtension =
                    glContext.getExtension("WEBGL_lose_context");
                if (loseContextExtension) {
                    loseContextExtension.loseContext();
                }
            } catch {}
        },
    };
}

function readRandomCryptoSeed() {
    if (!globalThis.crypto?.getRandomValues) {
        return 0;
    }
    const seedBuffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(seedBuffer);
    return seedBuffer[0];
}

function generateRandomSeed() {
    const cryptoSeed = readRandomCryptoSeed();
    if (cryptoSeed !== 0) {
        return cryptoSeed;
    }
    const timestampBits =
        (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    return timestampBits || 1;
}

function resolveSceneMode(stage) {
    const sceneAttribute = stage.getAttribute("data-scene") || "";
    if (
        sceneAttribute === "portals" ||
        stage.getAttribute("data-portal") === "1"
    ) {
        return SCENE_PORTALS;
    }
    if (sceneAttribute === "keypad") {
        return SCENE_KEYPAD;
    }
    return SCENE_GRID;
}

function setupModulePrefetch(abortSignal) {
    let isKeypadWarmed = false;
    let isPortalsWarmed = false;

    document.addEventListener(
        "pointerover",
        (pointerEvent) => {
            const eventTarget = pointerEvent.target;
            if (!(eventTarget instanceof Element)) {
                return;
            }
            const anchorElement = eventTarget.closest("a[href]");
            if (!anchorElement) {
                return;
            }
            const targetHref = anchorElement.getAttribute("href") || "";
            const isHomeRoute =
                targetHref === "/" || /^\/(es|fr|de|ja)\/$/.test(targetHref);
            if (isHomeRoute && !isKeypadWarmed) {
                isKeypadWarmed = true;
                import("./keypad.js").catch(() => null);
                return;
            }
            if (targetHref.endsWith("/ugce/") && !isPortalsWarmed) {
                isPortalsWarmed = true;
                import("./portals.js").catch(() => null);
            }
        },
        { passive: true, signal: abortSignal }
    );
}

function readPortalFrameViews(
    wasmExports,
    stageRenderer,
    portalCount,
    particleCount
) {
    if (portalCount <= 0) {
        return { portalsView: null, ringsView: null, particlesView: null };
    }
    const portalsView = readFloat32View(
        wasmExports.memory,
        wasmExports.get_portals_pointer(),
        portalCount * PORTAL_FLOATS
    );
    const ringsView = readFloat32View(
        wasmExports.memory,
        wasmExports.get_rings_pointer(),
        portalCount * RING_FLOATS_PER_PORTAL
    );
    const metadataView = readUint32View(
        wasmExports.memory,
        wasmExports.get_portal_metadata_pointer(),
        portalCount * METADATA_U32S_PER_PORTAL
    );
    if (!portalsView || !ringsView || !metadataView) {
        return null;
    }
    stageRenderer.synchronizeLabels(portalCount, metadataView);

    if (particleCount <= 0) {
        return { portalsView, ringsView, particlesView: null };
    }
    const particlesView = readFloat32View(
        wasmExports.memory,
        wasmExports.get_particles_pointer(),
        particleCount * PARTICLE_FLOATS
    );
    if (!particlesView) {
        return null;
    }
    return { portalsView, ringsView, particlesView };
}

function initializeStage() {
    const stage = document.getElementById("stage");
    if (!(stage instanceof HTMLCanvasElement)) {
        return;
    }

    const stageContainer = stage.closest(".site-stage");
    if (!(stageContainer instanceof HTMLElement)) {
        return;
    }

    const stageSurface = document.getElementById("stage-surface");
    if (!(stageSurface instanceof HTMLElement)) {
        return;
    }

    const stageLinkElement = document.getElementById("stage-link");
    const stageLink =
        stageLinkElement instanceof HTMLAnchorElement
            ? stageLinkElement
            : null;

    const sceneMode = resolveSceneMode(stage);
    let shaderModulePromise = null;
    if (sceneMode === SCENE_KEYPAD) {
        shaderModulePromise = import("./keypad.js").catch(() => null);
    } else if (sceneMode === SCENE_PORTALS) {
        shaderModulePromise = import("./portals.js").catch(() => null);
    }

    const stageRenderer = createStageRenderer(stage, sceneMode);
    if (!stageRenderer) {
        return;
    }

    const abortController = new AbortController();
    const abortSignal = abortController.signal;
    setupModulePrefetch(abortSignal);

    let maximumDevicePixelRatio = Math.min(
        Math.max(window.devicePixelRatio || 1, 1),
        2
    );
    let cssWidth = 1;
    let cssHeight = 1;
    let devicePixelRatio = maximumDevicePixelRatio;
    let animationFrameId = 0;
    let previousTimestamp = performance.now();
    let isStopped = false;

    let wasmExports = null;
    let portalCount = 0;
    let particleCount = 0;
    let pendingPointerPosition = null;
    const fallbackCameraBuffer = createInitialCameraBuffer();

    function scheduleAnimationFrame() {
        if (isStopped || document.hidden) {
            return;
        }
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(renderAnimationFrame);
    }

    function clampStageDimension(pixelSize) {
        return Math.min(
            MAXIMUM_STAGE_DIMENSION,
            Math.max(1, Math.round(pixelSize))
        );
    }

    function measureStageContainer() {
        const containerBounds = stageContainer.getBoundingClientRect();
        if (
            Number.isFinite(containerBounds.width) &&
            containerBounds.width > 0
        ) {
            cssWidth = Math.max(1, containerBounds.width);
        }
        if (
            Number.isFinite(containerBounds.height) &&
            containerBounds.height > 0
        ) {
            cssHeight = Math.max(1, containerBounds.height);
        }
        devicePixelRatio = maximumDevicePixelRatio;
        const targetWidth = clampStageDimension(cssWidth * devicePixelRatio);
        const targetHeight = clampStageDimension(cssHeight * devicePixelRatio);
        if (stage.width !== targetWidth || stage.height !== targetHeight) {
            stage.width = targetWidth;
            stage.height = targetHeight;
        }
        applyFallbackWideFraming(fallbackCameraBuffer, cssWidth, cssHeight);
    }

    measureStageContainer();
    if (
        stageRenderer.render(
            cssWidth,
            cssHeight,
            devicePixelRatio,
            fallbackCameraBuffer,
            null,
            0,
            null,
            null,
            0,
            null
        )
    ) {
        stage.classList.add("stage--ready");
    }

    function attachLoadedShaderModule(shaderModule) {
        if (isStopped || !shaderModule) {
            return;
        }
        if (sceneMode === SCENE_KEYPAD) {
            stageRenderer.attachKeypadModule(shaderModule);
        } else if (sceneMode === SCENE_PORTALS) {
            stageRenderer.attachPortalsModule(shaderModule);
        }
        scheduleAnimationFrame();
    }

    if (shaderModulePromise) {
        shaderModulePromise.then(attachLoadedShaderModule);
    }

    function attachLoadedWasm(loadedExports) {
        if (isStopped || !loadedExports) {
            return;
        }
        try {
            loadedExports.initialize_scene(
                cssWidth,
                cssHeight,
                sceneMode,
                generateRandomSeed()
            );
            const rawPortalCount = loadedExports.get_portal_count();
            portalCount = Math.min(
                MAXIMUM_PORTALS,
                Math.max(0, rawPortalCount)
            );
            const rawParticleCount = loadedExports.get_particle_count();
            particleCount =
                portalCount > 0
                    ? Math.min(512, Math.max(0, rawParticleCount))
                    : 0;
            if (pendingPointerPosition) {
                loadedExports.pointer_move(
                    pendingPointerPosition[0],
                    pendingPointerPosition[1]
                );
            }
            wasmExports = loadedExports;
            scheduleAnimationFrame();
        } catch {
            shutdownToFallback();
        }
    }

    INITIAL_WASM_PROMISE.then(attachLoadedWasm);

    function synchronizeStageSize() {
        if (isStopped) {
            return;
        }
        measureStageContainer();
        if (wasmExports) {
            wasmExports.resize_scene(cssWidth, cssHeight);
        }
    }

    const resizeObserver = new ResizeObserver(synchronizeStageSize);

    let activeStageLinkHref = "";
    let isMousePointerActive = false;
    const defaultTargetHref =
        stage.getAttribute("data-target-href") ||
        stage.getAttribute("data-portal-href") ||
        "";

    function resolveEntityTargetHref(hitEntityIndex) {
        if (sceneMode === SCENE_GRID || hitEntityIndex < 0) {
            return "";
        }
        const entityAttribute = `data-portal-${hitEntityIndex}-href`;
        const candidateHref =
            stage.getAttribute(entityAttribute) || defaultTargetHref;
        const isSafeRelativePath =
            candidateHref.startsWith("/") && !candidateHref.startsWith("//");
        if (!isSafeRelativePath) {
            return "";
        }
        return candidateHref;
    }

    function applyStageLinkHref(nextHref) {
        if (!stageLink || nextHref === activeStageLinkHref) {
            return;
        }
        activeStageLinkHref = nextHref;
        if (!nextHref) {
            stageLink.classList.remove("stage-link--active");
            stageLink.removeAttribute("href");
            return;
        }
        stageLink.setAttribute("href", nextHref);
        stageLink.classList.add("stage-link--active");
    }

    function synchronizeStageLink() {
        const canHitEntities =
            !isStopped &&
            isMousePointerActive &&
            Boolean(pendingPointerPosition) &&
            Boolean(wasmExports) &&
            stageRenderer.areEntitiesReady();
        if (!canHitEntities) {
            applyStageLinkHref("");
            return;
        }
        const hitEntityIndex = wasmExports.click_stage(
            pendingPointerPosition[0],
            pendingPointerPosition[1]
        );
        applyStageLinkHref(resolveEntityTargetHref(hitEntityIndex));
    }

    function shutdownToFallback() {
        if (isStopped) {
            return;
        }
        isStopped = true;
        cancelAnimationFrame(animationFrameId);
        abortController.abort();
        resizeObserver.disconnect();
        applyStageLinkHref("");
        stageContainer.classList.remove("site-stage--interactive-hover");
        stage.classList.remove("stage--ready");
        stageRenderer.dispose();
    }

    resizeObserver.observe(stageContainer);

    stage.addEventListener(
        "webglcontextlost",
        (contextEvent) => {
            contextEvent.preventDefault();
            shutdownToFallback();
        },
        { signal: abortSignal }
    );

    let activeTouchPointerId = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let previousTouchX = 0;
    let previousTouchY = 0;
    let touchNormalizedX = 0;
    let touchNormalizedY = 0;
    let isTouchDragging = false;

    function clampSignedUnit(rawValue) {
        return Math.min(1, Math.max(-1, rawValue));
    }

    function readCurrentCameraNormalized() {
        if (!wasmExports) {
            return [0, 0];
        }
        const cameraView = readFloat32View(
            wasmExports.memory,
            wasmExports.get_camera_pointer(),
            CAMERA_FLOATS
        );
        if (!cameraView) {
            return [0, 0];
        }
        const safeWidth = Math.max(1, cssWidth);
        const safeHeight = Math.max(1, cssHeight);
        const aspectRatio = safeWidth / safeHeight;
        const narrowness = Math.min(
            1,
            Math.max(0, (1.35 - aspectRatio) / 0.85)
        );
        const horizontalPanRange = 0.52 + narrowness * 1.78;
        return [
            clampSignedUnit(cameraView[0] / horizontalPanRange),
            clampSignedUnit(-cameraView[1] / 0.2),
        ];
    }

    function handleTouchSwipeMove(pointerEvent) {
        if (pointerEvent.pointerId !== activeTouchPointerId) {
            return;
        }
        const totalDeltaX = pointerEvent.clientX - touchStartX;
        const totalDeltaY = pointerEvent.clientY - touchStartY;
        const movedDistanceSquared =
            totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY;
        if (!isTouchDragging && movedDistanceSquared < 36) {
            return;
        }
        if (!isTouchDragging) {
            isTouchDragging = true;
            previousTouchX = pointerEvent.clientX;
            previousTouchY = pointerEvent.clientY;
            const currentNormalized = readCurrentCameraNormalized();
            touchNormalizedX = currentNormalized[0];
            touchNormalizedY = currentNormalized[1];
        }
        const safeWidth = Math.max(1, cssWidth);
        const safeHeight = Math.max(1, cssHeight);
        const stepX =
            ((pointerEvent.clientX - previousTouchX) / safeWidth) * 2;
        const stepY =
            ((pointerEvent.clientY - previousTouchY) / safeHeight) * 2;
        previousTouchX = pointerEvent.clientX;
        previousTouchY = pointerEvent.clientY;
        touchNormalizedX = clampSignedUnit(touchNormalizedX + stepX);
        touchNormalizedY = clampSignedUnit(touchNormalizedY + stepY);
        sendPointerMove(
            (touchNormalizedX * 0.5 + 0.5) * safeWidth,
            (touchNormalizedY * 0.5 + 0.5) * safeHeight
        );
    }

    function sendPointerMove(pointerX, pointerY) {
        pendingPointerPosition = [pointerX, pointerY];
        if (wasmExports) {
            wasmExports.pointer_move(pointerX, pointerY);
        }
    }

    function sendPointerLeave() {
        isMousePointerActive = false;
        pendingPointerPosition = null;
        applyStageLinkHref("");
        if (wasmExports) {
            wasmExports.pointer_leave();
        }
        stageContainer.classList.remove("site-stage--interactive-hover");
    }

    function endTouchInteraction(pointerId) {
        if (activeTouchPointerId !== pointerId) {
            return;
        }
        const wasDragging = isTouchDragging;
        activeTouchPointerId = null;
        isTouchDragging = false;
        if (isStopped || !wasDragging) {
            return;
        }
        sendPointerLeave();
    }

    function isDirectStageTarget(eventTarget) {
        return (
            eventTarget === stageSurface ||
            eventTarget === stageLink ||
            eventTarget === stageContainer
        );
    }

    stageSurface.addEventListener(
        "touchmove",
        (touchEvent) => {
            if (activeTouchPointerId === null || !touchEvent.cancelable) {
                return;
            }
            touchEvent.preventDefault();
        },
        { passive: false, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointerdown",
        (pointerEvent) => {
            if (isStopped || pointerEvent.pointerType !== "touch") {
                return;
            }
            if (activeTouchPointerId !== null) {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            isMousePointerActive = false;
            applyStageLinkHref("");
            activeTouchPointerId = pointerEvent.pointerId;
            touchStartX = pointerEvent.clientX;
            touchStartY = pointerEvent.clientY;
            isTouchDragging = false;
            try {
                stageSurface.setPointerCapture(pointerEvent.pointerId);
            } catch {}
        },
        { passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointerdown",
        (pointerEvent) => {
            if (isStopped || pointerEvent.pointerType === "touch") {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            if (!isDirectStageTarget(pointerEvent.target)) {
                isMousePointerActive = false;
                applyStageLinkHref("");
                return;
            }
            const containerBounds = stageContainer.getBoundingClientRect();
            isMousePointerActive = true;
            sendPointerMove(
                pointerEvent.clientX - containerBounds.left,
                pointerEvent.clientY - containerBounds.top
            );
            synchronizeStageLink();
        },
        { capture: true, passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointermove",
        (pointerEvent) => {
            if (isStopped) {
                return;
            }
            if (
                !Number.isFinite(pointerEvent.clientX) ||
                !Number.isFinite(pointerEvent.clientY)
            ) {
                return;
            }
            if (pointerEvent.pointerType === "touch") {
                handleTouchSwipeMove(pointerEvent);
                return;
            }
            const containerBounds = stageContainer.getBoundingClientRect();
            sendPointerMove(
                pointerEvent.clientX - containerBounds.left,
                pointerEvent.clientY - containerBounds.top
            );
            isMousePointerActive = isDirectStageTarget(pointerEvent.target);
            synchronizeStageLink();
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointerup",
        (pointerEvent) => {
            if (pointerEvent.pointerType !== "touch") {
                return;
            }
            endTouchInteraction(pointerEvent.pointerId);
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "pointercancel",
        (pointerEvent) => {
            if (pointerEvent.pointerType !== "touch") {
                return;
            }
            endTouchInteraction(pointerEvent.pointerId);
        },
        { passive: true, signal: abortSignal }
    );

    stageSurface.addEventListener(
        "lostpointercapture",
        (pointerEvent) => {
            endTouchInteraction(pointerEvent.pointerId);
        },
        { passive: true, signal: abortSignal }
    );

    stageContainer.addEventListener(
        "pointerleave",
        (pointerEvent) => {
            if (isStopped || pointerEvent.pointerType === "touch") {
                return;
            }
            sendPointerLeave();
        },
        { passive: true, signal: abortSignal }
    );

    function registerStageClickNavigation() {
        if (sceneMode === SCENE_GRID) {
            return;
        }
        stageContainer.addEventListener(
            "click",
            (clickEvent) => {
                if (
                    isStopped ||
                    !wasmExports ||
                    clickEvent.button !== 0 ||
                    clickEvent.target === stageLink
                ) {
                    return;
                }
                if (!isDirectStageTarget(clickEvent.target)) {
                    return;
                }
                const validClientX = Number.isFinite(clickEvent.clientX);
                const validClientY = Number.isFinite(clickEvent.clientY);
                if (!validClientX || !validClientY) {
                    return;
                }
                const containerBounds = stageContainer.getBoundingClientRect();
                const stageX = clickEvent.clientX - containerBounds.left;
                const stageY = clickEvent.clientY - containerBounds.top;
                const hitEntityIndex = wasmExports.click_stage(stageX, stageY);
                const targetHref = resolveEntityTargetHref(hitEntityIndex);
                if (!targetHref) {
                    return;
                }
                window.location.assign(targetHref);
            },
            { passive: true, signal: abortSignal }
        );
    }

    registerStageClickNavigation();

    const motionScale = 1.0;

    function renderFallbackGridFrame(deltaSeconds) {
        fallbackCameraBuffer[7] =
            (fallbackCameraBuffer[7] + deltaSeconds * 0.85 * motionScale) %
            MAJOR_GRID_STEP;
        const renderedGrid = stageRenderer.render(
            cssWidth,
            cssHeight,
            devicePixelRatio,
            fallbackCameraBuffer,
            null,
            0,
            null,
            null,
            0,
            null
        );
        if (!renderedGrid) {
            shutdownToFallback();
            return;
        }
        scheduleAnimationFrame();
    }

    function renderAnimationFrame(currentTimestamp) {
        if (isStopped) {
            return;
        }
        try {
            const safeTimestamp = Number.isFinite(currentTimestamp)
                ? currentTimestamp
                : previousTimestamp + 16;
            const elapsedSeconds = (safeTimestamp - previousTimestamp) / 1000;
            const deltaSeconds = Math.min(
                0.1,
                Math.max(0.0005, elapsedSeconds)
            );
            previousTimestamp = safeTimestamp;

            stageRenderer.pollAsynchronousJobs();

            if (!wasmExports) {
                renderFallbackGridFrame(deltaSeconds);
                return;
            }

            const entitiesReady = stageRenderer.areEntitiesReady() ? 1 : 0;
            const qualityTier = wasmExports.step_scene(
                deltaSeconds,
                motionScale,
                entitiesReady
            );
            if (qualityTier >= 1 && maximumDevicePixelRatio > 1) {
                maximumDevicePixelRatio = 1;
                synchronizeStageSize();
            }

            if (sceneMode !== SCENE_GRID) {
                const isHovered = wasmExports.is_interactive_hovered() !== 0;
                stageContainer.classList.toggle(
                    "site-stage--interactive-hover",
                    isHovered
                );
                synchronizeStageLink();
            }

            const cameraView = readFloat32View(
                wasmExports.memory,
                wasmExports.get_camera_pointer(),
                CAMERA_FLOATS
            );
            const keypadView = readFloat32View(
                wasmExports.memory,
                wasmExports.get_keypad_pointer(),
                KEYPAD_FLOATS
            );
            const portalViews = readPortalFrameViews(
                wasmExports,
                stageRenderer,
                portalCount,
                particleCount
            );
            if (!cameraView || !keypadView || !portalViews) {
                shutdownToFallback();
                return;
            }

            const renderedScene = stageRenderer.render(
                cssWidth,
                cssHeight,
                devicePixelRatio,
                cameraView,
                keypadView,
                portalCount,
                portalViews.portalsView,
                portalViews.ringsView,
                particleCount,
                portalViews.particlesView
            );
            if (!renderedScene) {
                shutdownToFallback();
                return;
            }

            scheduleAnimationFrame();
        } catch {
            shutdownToFallback();
        }
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (isStopped) {
                return;
            }
            if (document.hidden) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
            previousTimestamp = performance.now();
            scheduleAnimationFrame();
        },
        { passive: true, signal: abortSignal }
    );

    window.addEventListener(
        "pageshow",
        () => {
            if (isStopped || document.hidden) {
                return;
            }
            previousTimestamp = performance.now();
            scheduleAnimationFrame();
        },
        { passive: true, signal: abortSignal }
    );

    scheduleAnimationFrame();
}

initializeStage();
