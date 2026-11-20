// Hardened Rust WASM + WebGL2 3D perspective stage and UGCE VRChat portal.
// Zero external imports, zero DOM/CSSOM string sinks, empty WASM imports,
// bounds-checked memory views, and fallback to the #2b2b2b CSS background.

const {
    ArrayBuffer,
    Float32Array,
    Math,
    Number,
    Object,
    String,
    Uint8Array,
    Uint32Array,
    URL,
    WebAssembly,
} = globalThis;

const WASM_URL = "/wasm/dezzyne_bg.wasm";
const MAX_WASM_BYTES = 65536;
const MAX_CANVAS_DIM = 8192;
const CAM_FLOATS = 20;
const PORTAL_FLOATS = 12;
const RING_FLOATS = 16;
const PARTICLE_FLOATS = 8;

const LABEL_TEX_W = 920;
const LABEL_TEX_H = 428;
const LABEL_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const FETCH_OPTS = Object.freeze({
    method: "GET",
    credentials: "same-origin",
    mode: "same-origin",
    redirect: "error",
});

const GL_CTX_OPTS = Object.freeze({
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
});

const REQUIRED_FN_EXPORTS = Object.freeze([
    "init_scene",
    "resize_scene",
    "pointer_move",
    "pointer_leave",
    "click_portal",
    "is_portal_hovered",
    "step_scene",
    "get_instance_id",
    "get_player_count",
    "get_countdown_sec",
    "get_camera_ptr",
    "get_portal_ptr",
    "get_rings_ptr",
    "get_particles_ptr",
    "get_particle_count",
]);

const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_dpr;
uniform vec4 u_cam[5];
uniform vec4 u_portal[3];
uniform vec4 u_rings[4];

out vec4 outColor;

vec2 gridAxis(vec2 coord, vec2 fw, float radiusPx) {
    vec2 coverage = clamp(1.0 - fw * 1.15, 0.0, 1.0);
    vec2 distPx = abs(fract(coord - 0.5) - 0.5) / max(fw, vec2(1e-4));
    vec2 edge = smoothstep(radiusPx - 0.55, radiusPx + 0.55, distPx);
    return (1.0 - edge) * coverage;
}

float hash21(vec2 p) {
    vec2 q = fract(p * vec2(123.34, 456.21));
    q += dot(q, q + 45.32);
    return fract(q.x * q.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
        v += amp * vnoise(p);
        p = rot * p * 2.03 + vec2(1.7, 9.2);
        amp *= 0.5;
    }
    return v;
}

float evalXzRing(float pDist, float ringR, float ringA) {
    if (ringA <= 0.001) {
        return 0.0;
    }
    float diff = abs(pDist - ringR);
    float core = exp(-diff * diff * 34.0);
    float halo = exp(-diff * diff * 5.5) * 0.45;
    return (core + halo) * ringA;
}

void main() {
    float px = gl_FragCoord.x / u_dpr;
    float py = u_res.y - gl_FragCoord.y / u_dpr;
    vec2 p = vec2(px, py);
    float halfH = max(u_res.y * 0.5, 1.0);

    float us = ((p.x - u_res.x * 0.5) / halfH) * u_cam[0].w;
    float vs = ((u_res.y * 0.5 - p.y) / halfH) * u_cam[0].w;
    vec3 camPos = u_cam[0].xyz;
    vec3 rayDir = u_cam[1].xyz + us * u_cam[2].xyz + vs * u_cam[3].xyz;
    vec3 d = normalize(rayDir);
    float scrollZ = u_cam[1].w;

    vec3 col = vec3(0.1686);
    vec2 uv = (p / u_res) - 0.5;
    col -= dot(uv, uv) * 0.032;
    float horizonBand = exp(-abs(d.y) * 16.0);
    col += vec3(0.022, 0.023, 0.025) * horizonBand;

    float floorDenom = min(d.y, -0.012);
    float tFloor = (u_cam[2].w - camPos.y) / floorDenom;
    vec2 floorRawXZ = camPos.xz + d.xz * tFloor;
    vec2 floorXZ = floorRawXZ + vec2(0.0, scrollZ);
    vec2 floorFw = fwidth(floorXZ);

    float floorMask = smoothstep(-0.014, -0.055, d.y);
    float floorMinorVis = floorMask * exp(-tFloor * 0.095);
    float floorMajorVis = floorMask * exp(-tFloor * 0.055);

    col -= vec3(0.015) * floorMask * exp(-tFloor * 0.14);

    vec2 fMinorXY = gridAxis(floorXZ, floorFw, 0.45);
    vec2 fMajorXY = gridAxis(floorXZ * 0.25, floorFw * 0.25, 0.72);
    float fMinor = max(fMinorXY.x, fMinorXY.y);
    float fMajor = max(fMajorXY.x, fMajorXY.y);
    float fCross = fMajorXY.x * fMajorXY.y;

    float cursorDist = length(floorRawXZ - u_cam[4].xy);
    float spotFalloff = exp(-cursorDist * cursorDist * 0.11);
    float floorSpot = spotFalloff * u_cam[4].w * floorMask;

    float floorLineLum = fMinor * 0.055 * floorMinorVis
        + fMajor * 0.135 * floorMajorVis
        + fCross * 0.075 * floorMajorVis
        + max(fMinor, fMajor) * 0.19 * floorSpot
        + 0.020 * floorSpot;
    col += vec3(floorLineLum);

    if (u_portal[1].z > 0.5) {
        float pScale = max(u_portal[2].z, 0.1);
        float pDist = length(floorRawXZ - u_portal[1].xy) / pScale;
        float basePool = exp(-pDist * pDist * 0.52) * u_portal[2].y;
        float floorGlow = basePool * floorMask;
        col += vec3(0.04, 0.13, 0.28) * floorGlow;
        col += vec3(0.16, 0.54, 1.00) * max(fMinor, fMajor) * floorGlow * 0.55;

        float ringDenom = min(d.y, -0.006);
        float tRing = (u_portal[1].w - camPos.y) / ringDenom;
        vec2 ringXZ = camPos.xz + d.xz * tRing;
        float ringVis = smoothstep(-0.008, -0.028, d.y);
        float pRingDist = length(ringXZ - u_portal[1].xy) / pScale;

        float ringSum = 0.0;
        for (int i = 0; i < 4; i++) {
            vec4 rv = u_rings[i];
            ringSum += evalXzRing(pRingDist, rv.x / pScale, rv.y);
            ringSum += evalXzRing(pRingDist, rv.z / pScale, rv.w);
        }
        float clampedRing = min(ringSum, 2.2) * ringVis * 0.92;
        vec3 ringGlow = vec3(0.18, 0.60, 1.00) * clampedRing;
        float inFront = smoothstep(
            u_portal[1].y + 0.04,
            u_portal[1].y - 0.04,
            ringXZ.y
        );
        col += ringGlow * (1.0 - inFront);

        vec2 pRadii = max(u_portal[0].zw, vec2(1.0));
        vec2 q = (p - u_portal[0].xy) / pRadii;
        float r = length(q);
        float pxScale = min(pRadii.x, pRadii.y);

        if (r < 1.36 && u_portal[0].z > 2.0) {
            float t = u_portal[2].x;
            float auraDist = max(r - 0.98, 0.0);
            float auraFade = smoothstep(1.36, 1.0, r);
            float aura = exp(-auraDist * 8.5) * auraFade;
            col += vec3(0.16, 0.54, 1.00) * aura * 0.52;

            if (r <= 1.04) {
                float edgePx = (r - 1.0) * pxScale;
                float mask = 1.0 - smoothstep(-1.2, 1.2, edgePx);

                float ang = atan(q.y, q.x);
                float pull = pow(1.0 - clamp(r, 0.0, 1.0), 1.35);
                float swirlAng = ang - 3.6 * pull + t * 1.35;
                vec2 dir = vec2(cos(swirlAng), sin(swirlAng));
                vec2 sp = dir * (r * 2.4 + 0.22);

                float n1 = fbm(sp * 1.65 - vec2(t * 0.34, t * 0.22));
                vec2 warp = vec2(n1 * 1.45 + t * 0.42, -n1 * 1.25);
                float n2 = fbm(sp * 2.95 + warp);

                float wave = sin(swirlAng * 2.0 + n1 * 4.0 - r * 4.6);
                float arms = 0.5 + 0.5 * wave;
                float wisp = pow(1.0 - abs(n2 * 2.0 - 1.0), 2.8);

                vec3 deepVoid = vec3(0.06, 0.04, 0.20);
                vec3 violet = vec3(0.45, 0.16, 0.84);
                vec3 vrcBlue = vec3(0.10, 0.48, 0.98);
                vec3 cyanWisp = vec3(0.50, 0.85, 1.00);

                float nMix = smoothstep(0.16, 0.84, n1);
                vec3 vortex = mix(deepVoid, violet, nMix);
                vortex = mix(vortex, vrcBlue, arms * (0.54 + 0.36 * r));
                vortex += cyanWisp * wisp * (0.36 + 0.26 * r);
                vortex *= 0.56 + 0.44 * smoothstep(0.0, 0.36, r);

                float innerRim = smoothstep(0.68, 0.99, r);
                vortex = mix(vortex, vec3(0.24, 0.66, 1.00), innerRim * 0.62);

                float shArg = ang * 3.0 - t * 2.8 + n1 * 3.0;
                float shimmer = 0.88 + 0.12 * sin(shArg);
                float rimLine = exp(-abs(edgePx + 1.5) * 0.62) * mask;
                vec3 rimCol = vec3(0.54, 0.86, 1.00) * shimmer;

                col = mix(col, vortex, mask);
                col += rimCol * rimLine * 0.76;
            }
        }

        col += ringGlow * inFront;
    }

    outColor = vec4(col, 1.0);
}
`;

const PART_VERT_SRC = `#version 300 es
in vec2 a_quad;
in vec4 a_part_a;
in vec4 a_part_b;

uniform vec2 u_res;

out vec2 v_uv;
out float v_alpha;
out float v_tint;

void main() {
    vec2 dir = a_part_a.zw;
    vec2 perp = vec2(-dir.y, dir.x);
    float along = a_part_b.x * a_part_b.y;
    float across = a_part_b.x;
    vec2 offset = dir * (a_quad.x * along) + perp * (a_quad.y * across);
    vec2 posPx = a_part_a.xy + offset;

    float ndcX = (posPx.x / max(u_res.x, 1.0)) * 2.0 - 1.0;
    float ndcY = 1.0 - (posPx.y / max(u_res.y, 1.0)) * 2.0;
    gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);

    v_uv = a_quad;
    v_alpha = a_part_b.z;
    v_tint = a_part_b.w;
}
`;

const PART_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
in float v_alpha;
in float v_tint;

out vec4 outColor;

void main() {
    if (v_tint < 0.5) {
        float d2 = dot(v_uv, v_uv);
        if (d2 > 1.0) {
            discard;
        }
        float core = exp(-d2 * 6.8);
        float halo = exp(-d2 * 2.2) * (1.0 - d2);
        float glow = core * 0.82 + halo * 0.58;

        float s = clamp(v_tint * 2.2, 0.0, 1.0);
        vec3 deepBlue = vec3(0.20, 0.64, 1.00);
        vec3 skyBlue = vec3(0.38, 0.80, 1.00);
        vec3 baseCol = mix(deepBlue, skyBlue, s);
        vec3 pCol = baseCol + vec3(0.86, 0.96, 1.00) * core * 0.50;
        outColor = vec4(pCol * glow * v_alpha, 1.0);
    } else {
        float xNorm = clamp((v_uv.x + 1.0) / 1.60, 0.0, 1.0);
        float nose = 1.0 - smoothstep(0.58, 1.0, v_uv.x);
        float tail = pow(xNorm, 1.70) * nose;

        float halfW = mix(0.28, 0.92, xNorm);
        float yn = v_uv.y / max(halfW, 0.1);
        float edgeY = 1.0 - smoothstep(0.75, 1.0, abs(v_uv.y));
        float body = exp(-yn * yn * 3.8) * edgeY * tail;

        vec2 headVec = vec2((v_uv.x - 0.56) * 2.5, v_uv.y * 1.15);
        float head = exp(-dot(headVec, headVec) * 5.8);
        float glow = body * 0.88 + head * 0.68;
        if (glow <= 0.002) {
            discard;
        }

        float shade = clamp(v_tint - 1.0, 0.0, 1.0);
        vec3 tailPurple = mix(
            vec3(0.54, 0.20, 0.96),
            vec3(0.72, 0.26, 0.94),
            shade
        );
        vec3 headPink = mix(
            vec3(0.94, 0.38, 0.86),
            vec3(1.00, 0.54, 0.90),
            shade
        );
        float gradT = clamp((v_uv.x + 0.55) / 1.20, 0.0, 1.0);
        vec3 pCol = mix(tailPurple, headPink, gradT);
        pCol += vec3(1.00, 0.90, 0.98) * head * 0.72;

        outColor = vec4(pCol * glow * v_alpha, 1.0);
    }
}
`;

const LABEL_VERT_SRC = `#version 300 es
in vec2 a_quad;

uniform vec2 u_res;
uniform vec4 u_rect;

out vec2 v_uv;

void main() {
    vec2 posPx = u_rect.xy + a_quad * u_rect.zw;
    float ndcX = (posPx.x / max(u_res.x, 1.0)) * 2.0 - 1.0;
    float ndcY = 1.0 - (posPx.y / max(u_res.y, 1.0)) * 2.0;
    gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);
    v_uv = a_quad * 0.5 + 0.5;
}
`;

const LABEL_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_tex;
uniform float u_alpha;

out vec4 outColor;

void main() {
    vec4 texel = texture(u_tex, v_uv);
    outColor = texel * u_alpha;
}
`;

function drawUsRegionBadge(ctx, cx, cy, radius) {
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const stripeCount = 7;
    const stripeH = (radius * 2) / stripeCount;
    const topY = cy - radius;
    const leftX = cx - radius;

    for (let i = 0; i < stripeCount; i++) {
        if (i % 2 === 0) {
            ctx.fillStyle = "#d92b3a";
        } else {
            ctx.fillStyle = "#f4f6f9";
        }
        ctx.fillRect(leftX, topY + i * stripeH, radius * 2, stripeH + 0.5);
    }

    ctx.fillStyle = "#1c4ca8";
    ctx.fillRect(leftX, topY, radius * 1.1, radius * 1.05);

    ctx.fillStyle = "#ffffff";
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            const sx = leftX + radius * 0.3 + col * (radius * 0.28);
            const sy = topY + radius * 0.35 + row * (radius * 0.34);
            ctx.beginPath();
            ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawBadgeRing(ctx, cx, cy, radius, strokeColor) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "rgba(14, 18, 26, 0.54)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawQuadPane(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
}

function drawWindowsBadge(ctx, cx, cy, radius) {
    const color = "#00a8ff";
    drawBadgeRing(ctx, cx, cy, radius, color);

    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = color;

    drawQuadPane(
        ctx,
        cx - 16.0,
        cy - 12.0,
        cx - 2.2,
        cy - 13.9,
        cx - 2.2,
        cy - 1.5,
        cx - 16.0,
        cy - 1.5
    );
    drawQuadPane(
        ctx,
        cx + 0.8,
        cy - 14.3,
        cx + 16.2,
        cy - 16.4,
        cx + 16.2,
        cy - 1.5,
        cx + 0.8,
        cy - 1.5
    );
    drawQuadPane(
        ctx,
        cx - 16.0,
        cy + 1.5,
        cx - 2.2,
        cy + 1.5,
        cx - 2.2,
        cy + 13.9,
        cx - 16.0,
        cy + 12.0
    );
    drawQuadPane(
        ctx,
        cx + 0.8,
        cy + 1.5,
        cx + 16.2,
        cy + 1.5,
        cx + 16.2,
        cy + 16.4,
        cx + 0.8,
        cy + 14.3
    );
    ctx.restore();
}

function drawAndroidBadge(ctx, cx, cy, radius) {
    const color = "#2ed57a";
    drawBadgeRing(ctx, cx, cy, radius, color);

    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";

    const domeY = cy + 9.5;
    ctx.beginPath();
    ctx.arc(cx, domeY, 18.2, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 9.2, cy - 4.5);
    ctx.lineTo(cx - 14.5, cy - 13.5);
    ctx.moveTo(cx + 9.2, cy - 4.5);
    ctx.lineTo(cx + 14.5, cy - 13.5);
    ctx.stroke();

    ctx.fillStyle = "#121822";
    ctx.beginPath();
    ctx.arc(cx - 8.2, cy + 2.0, 2.3, 0, Math.PI * 2);
    ctx.arc(cx + 8.2, cy + 2.0, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawAppleBadge(ctx, cx, cy, radius) {
    const color = "#e8eaf2";
    drawBadgeRing(ctx, cx, cy, radius, color);

    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = color;
    ctx.translate(cx - 11.6 * 1.46, cy - 12.2 * 1.46);
    ctx.scale(1.46, 1.46);

    ctx.beginPath();
    ctx.moveTo(12.0, 6.8);
    ctx.bezierCurveTo(10.5, 6.8, 9.2, 5.6, 7.6, 5.7);
    ctx.bezierCurveTo(5.1, 5.8, 2.8, 7.6, 2.8, 11.4);
    ctx.bezierCurveTo(2.8, 15.6, 5.9, 22.2, 8.5, 22.2);
    ctx.bezierCurveTo(9.9, 22.2, 10.6, 21.2, 12.1, 21.2);
    ctx.bezierCurveTo(13.6, 21.2, 14.2, 22.2, 15.7, 22.2);
    ctx.bezierCurveTo(17.7, 22.2, 19.3, 19.0, 20.2, 16.6);
    ctx.bezierCurveTo(17.1, 15.3, 16.7, 10.5, 19.6, 8.8);
    ctx.bezierCurveTo(18.3, 6.8, 16.4, 5.7, 14.5, 5.7);
    ctx.bezierCurveTo(13.0, 5.7, 12.9, 6.8, 12.0, 6.8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(11.9, 5.5);
    ctx.bezierCurveTo(11.7, 3.2, 13.7, 1.1, 16.0, 0.9);
    ctx.bezierCurveTo(16.3, 3.3, 14.2, 5.6, 11.9, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function paintPortalLabel(ctx, instanceId, playerCount, countdownSec) {
    ctx.clearRect(0, 0, LABEL_TEX_W, LABEL_TEX_H);

    const midX = LABEL_TEX_W * 0.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f5f7fa";
    ctx.shadowColor = "rgba(0, 0, 0, 0.88)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.font = `500 42px ${LABEL_FONT}`;
    ctx.fillText("Coming Soon", midX, 58);

    ctx.font = `400 34px ${LABEL_FONT}`;
    ctx.fillText("Dezzyne", midX, 114);

    const regionStr = `(W) #${String(instanceId)}  Public`;
    ctx.font = `400 32px ${LABEL_FONT}`;
    const textW = ctx.measureText(regionStr).width;
    const badgeR = 14;
    const gap = 11;
    const totalW = badgeR * 2 + gap + textW;
    const startX = midX - totalW * 0.5;

    drawUsRegionBadge(ctx, startX + badgeR, 170 - 11, badgeR);

    ctx.textAlign = "left";
    ctx.fillStyle = "#f5f7fa";
    ctx.shadowColor = "rgba(0, 0, 0, 0.88)";
    ctx.shadowBlur = 7;
    ctx.fillText(regionStr, startX + badgeR * 2 + gap, 170);

    ctx.textAlign = "center";
    ctx.font = `400 32px ${LABEL_FONT}`;
    ctx.fillText(`${String(playerCount)} / 80`, midX, 226);

    ctx.font = `700 42px ${LABEL_FONT}`;
    ctx.fillText(String(countdownSec), midX, 288);

    // VRChat platform compatibility badges at upper-right of portal oval
    const platY = 371;
    const platR = 35;
    const platStep = 80;
    const firstPlatX = midX + 217;

    drawWindowsBadge(ctx, firstPlatX, platY, platR);
    drawAndroidBadge(ctx, firstPlatX + platStep, platY, platR);
    drawAppleBadge(ctx, firstPlatX + platStep * 2, platY, platR);
}

function hasValidWasmHeader(bytes) {
    if (!(bytes instanceof ArrayBuffer)) {
        return false;
    }
    if (bytes.byteLength < 8 || bytes.byteLength > MAX_WASM_BYTES) {
        return false;
    }
    const header = new Uint8Array(bytes, 0, 8);
    return (
        header[0] === 0x00 &&
        header[1] === 0x61 &&
        header[2] === 0x73 &&
        header[3] === 0x6d &&
        header[4] === 0x01 &&
        header[5] === 0x00 &&
        header[6] === 0x00 &&
        header[7] === 0x00
    );
}

async function loadVerifiedWasm() {
    if (typeof WebAssembly !== "object" || WebAssembly === null) {
        return null;
    }

    const resp = await fetch(WASM_URL, FETCH_OPTS);
    if (!resp.ok || resp.status !== 200 || resp.type !== "basic") {
        return null;
    }

    const resUrl = new URL(resp.url, window.location.origin);
    if (resUrl.origin !== window.location.origin) {
        return null;
    }
    if (resUrl.pathname !== WASM_URL) {
        return null;
    }

    const rawType = resp.headers.get("content-type") || "";
    const contentType = rawType.toLowerCase();
    const isWasmMime = contentType.startsWith("application/wasm");
    const isOctetMime = contentType.startsWith("application/octet-stream");
    if (contentType && !isWasmMime && !isOctetMime) {
        return null;
    }

    const bytes = await resp.arrayBuffer();
    if (!hasValidWasmHeader(bytes)) {
        return null;
    }

    const emptyImports = Object.create(null);
    const { instance } = await WebAssembly.instantiate(bytes, emptyImports);
    const exports = instance?.exports;
    if (!exports || !(exports.memory instanceof WebAssembly.Memory)) {
        return null;
    }

    for (let i = 0; i < REQUIRED_FN_EXPORTS.length; i++) {
        const fnName = REQUIRED_FN_EXPORTS[i];
        if (typeof exports[fnName] !== "function") {
            return null;
        }
    }

    return exports;
}

function readF32View(memory, ptr, length) {
    if (length === 0) {
        return new Float32Array(0);
    }
    if (!Number.isInteger(ptr) || ptr < 0 || (ptr & 3) !== 0) {
        return null;
    }
    const buf = memory.buffer;
    const byteLen = length * 4;
    if (ptr + byteLen > buf.byteLength) {
        return null;
    }
    return new Float32Array(buf, ptr, length);
}

function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) {
        return null;
    }
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

function buildProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
        if (vs) {
            gl.deleteShader(vs);
        }
        if (fs) {
            gl.deleteShader(fs);
        }
        return null;
    }

    const prog = gl.createProgram();
    if (!prog) {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        return null;
    }
    return prog;
}

function createWebGL2Renderer(canvas, hasPortal, particleCount) {
    const gl = canvas.getContext("webgl2", GL_CTX_OPTS);
    if (!gl) {
        return null;
    }

    const stageProg = buildProgram(gl, VERT_SRC, FRAG_SRC);
    if (!stageProg) {
        return null;
    }

    const stageVao = gl.createVertexArray();
    const triBuf = gl.createBuffer();
    if (!stageVao || !triBuf) {
        return null;
    }

    gl.bindVertexArray(stageVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
    );

    const locPos = gl.getAttribLocation(stageProg, "a_pos");
    if (locPos < 0) {
        return null;
    }
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    const stageUni = Object.assign(Object.create(null), {
        res: gl.getUniformLocation(stageProg, "u_res"),
        dpr: gl.getUniformLocation(stageProg, "u_dpr"),
        cam: gl.getUniformLocation(stageProg, "u_cam[0]"),
        portal: gl.getUniformLocation(stageProg, "u_portal[0]"),
        rings: gl.getUniformLocation(stageProg, "u_rings[0]"),
    });

    let partProg = null;
    let partVao = null;
    let quadBuf = null;
    let instBuf = null;
    let partResLoc = null;

    let labelProg = null;
    let labelVao = null;
    let labelTex = null;
    let labelCanvas = null;
    let labelCtx = null;
    let labelUni = null;
    let lastCountdown = -1;

    if (hasPortal && particleCount > 0) {
        partProg = buildProgram(gl, PART_VERT_SRC, PART_FRAG_SRC);
        partVao = gl.createVertexArray();
        quadBuf = gl.createBuffer();
        instBuf = gl.createBuffer();
        if (!partProg || !partVao || !quadBuf || !instBuf) {
            return null;
        }

        const quadVerts = new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ]);

        gl.bindVertexArray(partVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        const locQuad = gl.getAttribLocation(partProg, "a_quad");
        if (locQuad < 0) {
            return null;
        }
        gl.enableVertexAttribArray(locQuad);
        gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
        const byteCap = particleCount * PARTICLE_FLOATS * 4;
        gl.bufferData(gl.ARRAY_BUFFER, byteCap, gl.DYNAMIC_DRAW);

        const locA = gl.getAttribLocation(partProg, "a_part_a");
        const locB = gl.getAttribLocation(partProg, "a_part_b");
        if (locA < 0 || locB < 0) {
            return null;
        }
        const stride = PARTICLE_FLOATS * 4;
        gl.enableVertexAttribArray(locA);
        gl.vertexAttribPointer(locA, 4, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(locA, 1);

        gl.enableVertexAttribArray(locB);
        gl.vertexAttribPointer(locB, 4, gl.FLOAT, false, stride, 16);
        gl.vertexAttribDivisor(locB, 1);

        partResLoc = gl.getUniformLocation(partProg, "u_res");

        labelProg = buildProgram(gl, LABEL_VERT_SRC, LABEL_FRAG_SRC);
        labelVao = gl.createVertexArray();
        labelTex = gl.createTexture();
        labelCanvas = document.createElement("canvas");
        labelCanvas.width = LABEL_TEX_W;
        labelCanvas.height = LABEL_TEX_H;
        labelCtx = labelCanvas.getContext("2d");

        if (!labelProg || !labelVao || !labelTex || !labelCtx) {
            return null;
        }

        gl.bindVertexArray(labelVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        const locLabelQuad = gl.getAttribLocation(labelProg, "a_quad");
        if (locLabelQuad < 0) {
            return null;
        }
        gl.enableVertexAttribArray(locLabelQuad);
        gl.vertexAttribPointer(locLabelQuad, 2, gl.FLOAT, false, 0, 0);

        gl.bindTexture(gl.TEXTURE_2D, labelTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_LINEAR
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        labelUni = Object.assign(Object.create(null), {
            res: gl.getUniformLocation(labelProg, "u_res"),
            rect: gl.getUniformLocation(labelProg, "u_rect"),
            tex: gl.getUniformLocation(labelProg, "u_tex"),
            alpha: gl.getUniformLocation(labelProg, "u_alpha"),
        });
    }

    return {
        updateLabel(instanceId, playerCount, countdownSec) {
            if (!labelCtx || !labelTex || countdownSec === lastCountdown) {
                return;
            }
            lastCountdown = countdownSec;
            paintPortalLabel(labelCtx, instanceId, playerCount, countdownSec);
            gl.bindTexture(gl.TEXTURE_2D, labelTex);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                labelCanvas
            );
            gl.generateMipmap(gl.TEXTURE_2D);
        },
        render(w, h, dpr, camBuf, portalBuf, ringBuf, partBuf) {
            if (gl.isContextLost()) {
                return false;
            }

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(stageProg);
            gl.bindVertexArray(stageVao);

            gl.uniform2f(stageUni.res, w, h);
            gl.uniform1f(stageUni.dpr, dpr);
            gl.uniform4fv(stageUni.cam, camBuf);
            gl.uniform4fv(stageUni.portal, portalBuf);
            gl.uniform4fv(stageUni.rings, ringBuf);

            gl.drawArrays(gl.TRIANGLES, 0, 3);

            if (partProg && partBuf && partBuf.length > 0) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                gl.useProgram(partProg);
                gl.bindVertexArray(partVao);
                gl.uniform2f(partResLoc, w, h);

                gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, partBuf);
                gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particleCount);

                if (labelProg && labelTex && portalBuf[3] > 2.0) {
                    const pcx = portalBuf[0];
                    const pcy = portalBuf[1];
                    const pry = portalBuf[3];
                    const alpha = Math.min(1, Math.max(0, portalBuf[9]));

                    const halfH = pry * 0.68;
                    const halfW = halfH * (LABEL_TEX_W / LABEL_TEX_H);
                    const labelCy = pcy - pry * 1.36;

                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    gl.useProgram(labelProg);
                    gl.bindVertexArray(labelVao);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, labelTex);

                    gl.uniform2f(labelUni.res, w, h);
                    gl.uniform4f(labelUni.rect, pcx, labelCy, halfW, halfH);
                    gl.uniform1i(labelUni.tex, 0);
                    gl.uniform1f(labelUni.alpha, alpha);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                }

                gl.disable(gl.BLEND);
            }

            return true;
        },
        dispose() {
            try {
                if (labelTex) {
                    gl.deleteTexture(labelTex);
                }
                if (labelVao) {
                    gl.deleteVertexArray(labelVao);
                }
                if (labelProg) {
                    gl.deleteProgram(labelProg);
                }
                if (instBuf) {
                    gl.deleteBuffer(instBuf);
                }
                if (quadBuf) {
                    gl.deleteBuffer(quadBuf);
                }
                if (partVao) {
                    gl.deleteVertexArray(partVao);
                }
                if (partProg) {
                    gl.deleteProgram(partProg);
                }
                gl.deleteBuffer(triBuf);
                gl.deleteVertexArray(stageVao);
                gl.deleteProgram(stageProg);
                const ext = gl.getExtension("WEBGL_lose_context");
                if (ext) {
                    ext.loseContext();
                }
            } catch {
                // Ignore disposal errors during context loss.
            }
        },
    };
}

function generateSeed() {
    if (globalThis.crypto?.getRandomValues) {
        const arr = new Uint32Array(1);
        globalThis.crypto.getRandomValues(arr);
        if (arr[0] !== 0) {
            return arr[0];
        }
    }
    return ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
}

async function boot() {
    const canvas = document.getElementById("wasm-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
        return;
    }

    const stage = canvas.closest(".site-stage");
    if (!(stage instanceof HTMLElement)) {
        return;
    }

    const hasPortal = canvas.getAttribute("data-portal") === "1";

    let wasm;
    try {
        wasm = await loadVerifiedWasm();
    } catch {
        return;
    }
    if (!wasm) {
        return;
    }

    const rawCount = wasm.get_particle_count();
    const particleCount = hasPortal ? Math.min(256, Math.max(0, rawCount)) : 0;

    const renderer = createWebGL2Renderer(canvas, hasPortal, particleCount);
    if (!renderer) {
        return;
    }

    const ac = new AbortController();
    const { signal } = ac;

    let maxDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    let cssW = 1;
    let cssH = 1;
    let dpr = maxDpr;
    let rafId = 0;
    let lastTs = performance.now();
    let revealed = false;
    let stopped = false;

    function clampCanvasDim(px) {
        return Math.min(MAX_CANVAS_DIM, Math.max(1, Math.round(px)));
    }

    function syncSize() {
        if (stopped) {
            return;
        }
        const rect = stage.getBoundingClientRect();
        if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
            return;
        }
        cssW = Math.max(1, rect.width);
        cssH = Math.max(1, rect.height);
        dpr = maxDpr;
        const targetW = clampCanvasDim(cssW * dpr);
        const targetH = clampCanvasDim(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
        wasm.resize_scene(cssW, cssH);
    }

    const ro = new ResizeObserver(syncSize);

    function shutdownToFallback() {
        if (stopped) {
            return;
        }
        stopped = true;
        cancelAnimationFrame(rafId);
        ac.abort();
        ro.disconnect();
        stage.classList.remove("site-stage--portal-hover");
        canvas.classList.remove("wasm-canvas--ready");
        renderer.dispose();
    }

    try {
        const initRect = stage.getBoundingClientRect();
        if (Number.isFinite(initRect.width)) {
            cssW = Math.max(1, initRect.width);
        }
        if (Number.isFinite(initRect.height)) {
            cssH = Math.max(1, initRect.height);
        }
        canvas.width = clampCanvasDim(cssW * dpr);
        canvas.height = clampCanvasDim(cssH * dpr);
        wasm.init_scene(cssW, cssH, hasPortal ? 1 : 0, generateSeed());
    } catch {
        shutdownToFallback();
        return;
    }

    const instanceId = hasPortal ? wasm.get_instance_id() : 0;
    const playerCount = hasPortal ? wasm.get_player_count() : 0;

    ro.observe(stage);

    canvas.addEventListener(
        "webglcontextlost",
        (e) => {
            e.preventDefault();
            shutdownToFallback();
        },
        { signal }
    );

    let activeTouchId = null;

    function endTouch(pointerId) {
        if (activeTouchId !== pointerId) {
            return;
        }
        activeTouchId = null;
        if (!stopped) {
            wasm.pointer_leave();
            stage.classList.remove("site-stage--portal-hover");
        }
    }

    canvas.addEventListener(
        "touchmove",
        (e) => {
            if (activeTouchId !== null && e.cancelable) {
                e.preventDefault();
            }
        },
        { passive: false, signal }
    );

    canvas.addEventListener(
        "pointerdown",
        (e) => {
            if (stopped || e.pointerType !== "touch") {
                return;
            }
            if (activeTouchId !== null) {
                return;
            }
            if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) {
                return;
            }
            activeTouchId = e.pointerId;
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                // Ignore if synthetic pointer cannot be captured.
            }
            const rect = stage.getBoundingClientRect();
            wasm.pointer_move(e.clientX - rect.left, e.clientY - rect.top);
        },
        { passive: true, signal }
    );

    stage.addEventListener(
        "pointermove",
        (e) => {
            if (stopped) {
                return;
            }
            if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) {
                return;
            }
            if (e.pointerType === "touch" && e.pointerId !== activeTouchId) {
                return;
            }
            const rect = stage.getBoundingClientRect();
            wasm.pointer_move(e.clientX - rect.left, e.clientY - rect.top);
        },
        { passive: true, signal }
    );

    canvas.addEventListener(
        "pointerup",
        (e) => {
            if (e.pointerType === "touch") {
                endTouch(e.pointerId);
            }
        },
        { passive: true, signal }
    );

    canvas.addEventListener(
        "pointercancel",
        (e) => {
            if (e.pointerType === "touch") {
                endTouch(e.pointerId);
            }
        },
        { passive: true, signal }
    );

    canvas.addEventListener(
        "lostpointercapture",
        (e) => {
            endTouch(e.pointerId);
        },
        { passive: true, signal }
    );

    stage.addEventListener(
        "pointerleave",
        (e) => {
            if (e.pointerType === "touch") {
                return;
            }
            if (!stopped) {
                wasm.pointer_leave();
                stage.classList.remove("site-stage--portal-hover");
            }
        },
        { passive: true, signal }
    );

    if (hasPortal) {
        const rawHref = canvas.getAttribute("data-portal-href") || "";
        stage.addEventListener(
            "click",
            (e) => {
                if (stopped || e.button !== 0) {
                    return;
                }
                const validX = Number.isFinite(e.clientX);
                const validY = Number.isFinite(e.clientY);
                if (!validX || !validY) {
                    return;
                }
                const rect = stage.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;
                const hit = wasm.click_portal(px, py) !== 0;
                const safePath =
                    rawHref.startsWith("/") && !rawHref.startsWith("//");
                if (hit && safePath) {
                    window.location.assign(rawHref);
                }
            },
            { passive: true, signal }
        );
    }

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motionScale = mq?.matches ? 0.0 : 1.0;

    function frame(now) {
        if (stopped) {
            return;
        }
        try {
            const safeNow = Number.isFinite(now) ? now : lastTs + 16;
            const elapsedSec = (safeNow - lastTs) / 1000;
            const dt = Math.min(0.1, Math.max(0.0005, elapsedSec));
            lastTs = safeNow;

            const tier = wasm.step_scene(dt, motionScale);
            if (tier === 1 && maxDpr > 1) {
                maxDpr = 1;
                syncSize();
            } else if (tier >= 2) {
                shutdownToFallback();
                return;
            }

            if (hasPortal) {
                const sec = wasm.get_countdown_sec();
                renderer.updateLabel(instanceId, playerCount, sec);
                const hovered = wasm.is_portal_hovered() !== 0;
                stage.classList.toggle("site-stage--portal-hover", hovered);
            }

            const camPtr = wasm.get_camera_ptr();
            const portalPtr = wasm.get_portal_ptr();
            const ringsPtr = wasm.get_rings_ptr();
            const camView = readF32View(wasm.memory, camPtr, CAM_FLOATS);
            const portalView = readF32View(
                wasm.memory,
                portalPtr,
                PORTAL_FLOATS
            );
            const ringView = readF32View(wasm.memory, ringsPtr, RING_FLOATS);

            let partView = null;
            if (hasPortal && particleCount > 0) {
                const partPtr = wasm.get_particles_ptr();
                const partLen = particleCount * PARTICLE_FLOATS;
                partView = readF32View(wasm.memory, partPtr, partLen);
                if (!partView) {
                    shutdownToFallback();
                    return;
                }
            }

            if (!camView || !portalView || !ringView) {
                shutdownToFallback();
                return;
            }
            const ok = renderer.render(
                cssW,
                cssH,
                dpr,
                camView,
                portalView,
                ringView,
                partView
            );
            if (!ok) {
                shutdownToFallback();
                return;
            }

            if (!revealed) {
                revealed = true;
                canvas.classList.add("wasm-canvas--ready");
            }

            if (!document.hidden) {
                rafId = requestAnimationFrame(frame);
            }
        } catch {
            shutdownToFallback();
        }
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (stopped) {
                return;
            }
            if (document.hidden) {
                cancelAnimationFrame(rafId);
            } else {
                lastTs = performance.now();
                rafId = requestAnimationFrame(frame);
            }
        },
        { passive: true, signal }
    );

    rafId = requestAnimationFrame(frame);
}

boot();
