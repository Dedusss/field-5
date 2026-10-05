export const VERT_SRC = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uWind;
uniform float uReduced;

out vec4 fragColor;

const vec3 DEEP    = vec3(0.043, 0.020, 0.051);
const vec3 PLUM    = vec3(0.239, 0.071, 0.251);
const vec3 MAGENTA = vec3(0.910, 0.310, 0.816);
const vec3 BONE    = vec3(0.965, 0.933, 0.973);

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float horizon = 0.22; // от низа кадра (горизонт на 78% высоты)
  float t = uTime * (1.0 - 0.55 * uReduced);
  float wind = uWind * (1.0 - 0.6 * uReduced);

  // базовый градиент: тёмная слива
  vec3 col = mix(DEEP, PLUM * 0.55, pow(clamp(uv.y / max(horizon, 0.001), 0.0, 1.0), 1.7) * 0.9);
  if (uv.y < horizon) col = DEEP * 0.72;

  // туманная маджента-глубина у горизонта
  float fog = exp(-abs(uv.y - horizon) * 9.0);
  col += MAGENTA * fog * (0.07 + uMid * 0.10 + uBass * 0.04);

  // дюны: три слоя fbm, «дыхание» от баса, дрейф от ветра
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float drift = t * (0.006 + fi * 0.0035) * (1.0 + wind * 2.4);
    float n = fbm(vec2(p.x * (1.35 + fi * 0.6) + fi * 7.31 + drift, fi * 3.7 + 2.1));
    float breathe = uBass * (0.050 - fi * 0.013);
    float top = horizon + 0.030 + fi * 0.055 + (n - 0.5) * (0.11 + fi * 0.05) + breathe;
    float inside = 1.0 - smoothstep(top - 0.0025, top + 0.0025, uv.y);
    vec3 dcol = mix(PLUM * (0.62 - fi * 0.14), DEEP, 0.35 + fi * 0.25);
    dcol += MAGENTA * (0.05 + 0.05 * uMid) * (1.0 - fi * 0.3);
    float rim = exp(-abs(uv.y - top) * 70.0);
    col = mix(col, dcol, inside);
    col += MAGENTA * rim * (0.20 + uMid * 0.22);
  }

  // луна-ядро с ореолом от uMid
  vec2 mpos = vec2(aspect * 0.72, 0.64);
  vec2 mp = p - mpos;
  float md = length(mp);
  float r = 0.054;
  float core = 1.0 - smoothstep(r - 0.003, r + 0.001, md);
  float halo = exp(-md * (8.5 - uMid * 2.2)) * (0.26 + uMid * 0.38);
  float shade = 1.0 - 0.4 * smoothstep(r * 0.45, r, md);
  col += BONE * halo;
  col = mix(col, BONE * shade, core);
  col += vec3((vnoise(p * 74.0) - 0.5) * 0.10) * core;

  // мерцающая пыль от uHigh
  vec2 dp = vec2(uv.x * aspect, uv.y) * 23.0;
  dp.y += t * 0.12;
  vec2 cell = floor(dp);
  vec2 fpos = fract(dp);
  float h1 = hash21(cell);
  float h2 = hash21(cell + 17.3);
  vec2 sp = 0.22 + 0.56 * vec2(h1, h2);
  float sd = length(fpos - sp);
  float alive = step(1.0 - (0.08 + uHigh * 0.42), h1);
  float tw = 0.5 + 0.5 * sin(t * (0.9 + h2 * 2.4) + h1 * 43.0);
  float star = (1.0 - smoothstep(0.0, 0.12, sd)) * alive * tw;
  col += (BONE * 0.7 + MAGENTA * 0.3) * star * (0.25 + uHigh * 0.75);

  // почва: тёмное русло с маджента-венами
  if (uv.y < horizon) {
    float veins = fbm(vec2(p.x * 3.5, (uv.y - horizon) * 14.0 + 5.0));
    col += MAGENTA * veins * 0.035 * (1.0 + uBass);
    col *= 0.9;
  }

  // виньетка и зерно против бандинга
  float vig = 1.0 - 0.42 * pow(clamp(length(uv - vec2(0.5, 0.42)) * 1.32, 0.0, 1.0), 2.3);
  col *= vig;
  col += (hash21(gl_FragCoord.xy + fract(t) * 61.7) - 0.5) * 0.014;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`
