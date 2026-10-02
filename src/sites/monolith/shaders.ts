/**
 * ЭКСП. 01 «МОНОЛИТ» — исходники шейдеров (WebGL2 / GLSL ES 3.00).
 *
 * Весь мир — рельеф, каньон, решётка монолитов, сигилы, туман, свет —
 * считается одним фрагментным шейдером методом raymarching по SDF.
 *
 * Синхронные константы с world.ts: сигилы -60/-150/-260/-380/-520,
 * бесконечные: z = -160 - 90*i (i >= 5), стороны чередуются по чётности i.
 */

export const VERT_SRC = `#version 300 es
void main() {
  // Полноэкранный треугольник без атрибутов: gl_VertexID -> позиции.
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}
`

export const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2  uRes;      // размер буфера в пикселях
uniform float uTime;     // мировое время (с)
uniform vec3  uCam;      // позиция камеры
uniform vec2  uLook;     // рысканье/тангаж (рад)
uniform vec3  uLight;    // позиция светоча (угля)
uniform float uLightI;   // интенсивность светоча (пульсация + вспышка)
uniform float uShift;    // 0..1 — сдвиг палитры (найдено сигилов / 5)
uniform float uAscend;   // 0..1 — восхождение (небо открывается)
uniform float uFogDens;  // множитель плотности тумана
uniform float uEndless;  // 1 — бесконечные сигилы существуют
uniform float uSteps;    // бюджет шагов марша
uniform vec4  uSigNear[6]; // xyz — позиция сигила, w: -1 пусто, 0 жив, 1 найден

out vec4 outColor;

const float PI = 3.14159265;

// ---------------------------------------------------------------- hash/шум
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }

float n21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i,                 vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ---------------------------------------------------------------- сигилы
// Позиции синхронны с world.ts. Бесконечные (i >= 5): z = -160 - 90*i.
void nearestSigil(float z, out float sz, out float sidx, out float sdist) {
  sz = -60.0; sidx = 0.0; sdist = 1e6;
  float d;
  d = abs(z + 60.0);  if (d < sdist) { sdist = d; sz = -60.0;  sidx = 0.0; }
  d = abs(z + 150.0); if (d < sdist) { sdist = d; sz = -150.0; sidx = 1.0; }
  d = abs(z + 260.0); if (d < sdist) { sdist = d; sz = -260.0; sidx = 2.0; }
  d = abs(z + 380.0); if (d < sdist) { sdist = d; sz = -380.0; sidx = 3.0; }
  d = abs(z + 520.0); if (d < sdist) { sdist = d; sz = -520.0; sidx = 4.0; }
  if (uEndless > 0.5) {
    float fi = (-160.0 - z) / 90.0;
    float i0 = max(floor(fi), 5.0);
    for (int k = 0; k < 2; k++) {
      float i = i0 + float(k);
      float zz = -160.0 - 90.0 * i;
      d = abs(z - zz);
      if (d < sdist) { sdist = d; sz = zz; sidx = i; }
    }
  }
}

// ---------------------------------------------------------------- SDF-мир
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Земля: чуть всхолмлённая равнина.
float groundH(vec2 xz) {
  return -0.24 + n21(xz * 0.17) * 0.34 + n21(xz * 0.045) * 0.18;
}

// Стены каньона: |x| около 10..11.6, высота до ~13..19 (зубчатый небосклон).
float wallD(vec3 p) {
  float wob = n21(vec2(p.z * 0.045, p.y * 0.09)) * 1.6
            + 0.3 * sin(p.y * 1.6 + n21(vec2(p.z * 0.2, 3.7)) * 2.0);
  float slab = (10.0 + wob) - abs(p.x);
  float top = 13.0 + n21(vec2(p.z * 0.023, 7.7)) * 6.0 - p.y;
  return max(slab, top) * 0.5;
}

// Монолит ячейки: бокс с базой в земле, малый поворот вокруг Y.
float monoBox(vec3 p, float zc, float xo, float w, float hh, float dep, float ang) {
  float ca = cos(ang), sa = sin(ang);
  vec2 q = mat2(ca, -sa, sa, ca) * vec2(p.x - xo, p.z - zc);
  return sdBox(vec3(q.x, p.y - (hh - 0.7) * 0.5, q.y), vec3(w, (hh + 0.7) * 0.5, dep));
}

// Решётка монолитов: доменное повторение по z с шагом 14, hash-вариации ячеек.
float dGrid(vec3 p) {
  float cid = floor(p.z / 14.0 + 0.5);
  float zc = cid * 14.0;

  // вокруг монолита-носителя сигила — расчистка
  float sz, sidx, sdist;
  nearestSigil(zc, sz, sidx, sdist);
  if (sdist < 9.6) return 1e5;

  vec2 h = fract(sin(vec2(cid * 127.1 + 311.7, cid * 269.5 + 183.3)) * 43758.5453);
  float w, hh, dep, xo, ang;
  bool twin = false;

  if (abs(cid + 1.0) < 0.5) {
    // герой первого кадра: правее центра, у самой камеры
    xo = 2.0; w = 1.8; hh = 8.6; dep = 1.35; ang = 0.1;
  } else if (abs(cid + 3.0) < 0.5) {
    // средний план слева
    xo = -4.3; w = 1.5; hh = 6.8; dep = 1.2; ang = -0.07;
  } else {
    if (h.x < 0.35) return 1e5;                 // ~35% ячеек пусто
    w   = 0.9 + h.y * 1.5;                       // 0.9..2.4
    hh  = 4.0 + fract(h.x * 13.73) * 8.0;        // 4..12
    dep = 0.75 + h.y * 1.05;
    float side = fract(h.y * 7.77) > 0.5 ? 1.0 : -1.0;
    xo  = side * (2.4 + fract(h.x * 5.19) * 4.1); // 2.4..6.5 от оси
    ang = (fract(h.y * 3.31) - 0.5) * 0.4;        // поворот до ±0.2 рад
    twin = fract(h.x * 7.13) > 0.84;              // «двойные» тонкие плиты
  }

  if (twin) {
    float d1 = monoBox(p, zc + 1.15, xo, w * 0.42, hh * 0.94, dep * 0.8, ang);
    float d2 = monoBox(p, zc - 1.15, xo, w * 0.42, hh * 0.88, dep * 0.8, ang);
    return min(d1, d2);
  }
  return monoBox(p, zc, xo, w, hh, dep, ang);
}

// Гарантированный монолит-носитель сигила: бокс с гранью на |x| = 3.2.
float dSigilMono(vec3 p) {
  float sz, sidx, sdist;
  nearestSigil(p.z, sz, sidx, sdist);
  float side = mod(sidx, 2.0) < 0.5 ? 1.0 : -1.0;
  const float H = 5.8;
  return sdBox(p - vec3(side * 3.9, (H - 0.7) * 0.5, sz), vec3(0.75, (H + 0.7) * 0.5, 0.75));
}

// Материалы: 1 земля, 2 стена, 3 монолит, 4 монолит-носитель сигила.
vec2 map(vec3 p) {
  float dG = (p.y - groundH(p.xz)) * 0.5;
  float d = dG;
  float m = 1.0;

  if (abs(p.x) > 7.4) {
    float dW = wallD(p);
    if (dW < d) { d = dW; m = 2.0; }
  }
  if (abs(p.x) < 9.6) {
    float dM = dGrid(p);
    float dS = dSigilMono(p);
    float dA = min(dM, dS);
    if (dA < 1e4) {
      float dB = smin(dA, dG, 0.85);   // мягкое укоренение в земле
      if (dB < d) { d = dB; m = dS < dM ? 4.0 : 3.0; }
    }
  }
  return vec2(d, m);
}

// ---------------------------------------------------------------- трассировка
vec2 march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.05;
  float m = -1.0;
  int budget = int(uSteps);
  for (int i = 0; i < 200; i++) {
    if (i >= budget) break;
    vec2 h = map(ro + rd * t);
    if (h.x < 0.0008 + 0.0012 * t) { m = h.y; break; }
    t += h.x * 0.9;
    if (t > tmax) break;
  }
  if (t > tmax) m = -1.0;
  return vec2(t, m);
}

vec3 calcN(vec3 p) {
  const float e = 0.011;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * map(p + k.xyy * e).x +
    k.yyx * map(p + k.yyx * e).x +
    k.yxy * map(p + k.yxy * e).x +
    k.xxx * map(p + k.xxx * e).x
  );
}

// Одна мягкая тень от светоча (для земли и монолитов; стены — без).
float softShadow(vec3 ro, vec3 rd, float maxT) {
  float res = 1.0;
  float t = 0.14;
  for (int i = 0; i < 24; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.05, 0.9);
    if (res < 0.02 || t > maxT) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 n) {
  float o = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 4; i++) {
    float h = 0.02 + 0.34 * float(i) / 3.0;
    float d = map(p + n * h).x;
    o += (h - d) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.8 * o, 0.0, 1.0);
}

// ---------------------------------------------------------------- атмосфера
vec3 skyCol(vec3 rd) {
  float y = clamp(rd.y, 0.0, 1.0);
  vec3 night = mix(vec3(0.036, 0.017, 0.008), vec3(0.009, 0.008, 0.007), pow(y, 0.42));
  night += vec3(0.36, 0.16, 0.05) * pow(1.0 - y, 7.0) * (0.55 + uShift * 0.6);
  vec3 warm = mix(vec3(0.30, 0.11, 0.035), vec3(0.85, 0.43, 0.16), pow(y, 0.8));
  return mix(night, warm, uAscend);
}

// Пластина-руна сигила. q в единицах полуплиты (~0.62 м).
float runePattern(vec2 q, float t) {
  float r = length(q);
  if (r > 1.18) return 0.0;
  float a = atan(q.y, q.x);
  float f = 0.0;
  f += smoothstep(0.05, 0.016, abs(r - 0.93));   // внешнее кольцо
  f += smoothstep(0.04, 0.014, abs(r - 0.58));   // внутреннее кольцо
  float sp = abs(fract((a + t * 0.05) * 8.0 / (2.0 * PI) + 0.5) - 0.5) * (2.0 * PI / 8.0);
  f += smoothstep(0.06, 0.02, sp) * smoothstep(0.55, 0.62, r) * smoothstep(0.99, 0.90, r);
  float dia = abs(q.x) + abs(q.y);
  f += smoothstep(0.05, 0.018, abs(dia - 0.34)) * smoothstep(0.52, 0.44, r);  // ромб
  f += smoothstep(0.05, 0.015, abs(r - 0.10));   // ядро
  return clamp(f, 0.0, 1.4);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// ---------------------------------------------------------------- кадр
void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;

  float yaw = uLook.x;
  float pit = clamp(uLook.y, -0.6, 0.6);
  float cp = cos(pit);
  vec3 fw = normalize(vec3(sin(yaw) * cp, sin(pit), -cos(yaw) * cp));
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + fw * 1.42);
  vec3 ro = uCam;

  const float TMAX = 95.0;
  vec2 hit = march(ro, rd, TMAX);
  float t = hit.x;
  float m = hit.y;
  bool isHit = m > 0.0;
  float tGlow = isHit ? t : TMAX;

  float pulse = uLightI;

  // цвет тумана: тёмный уголь -> тёплый янтарь по вкладу светоча
  vec3 toL = uLight - ro;
  float dl = length(toL);
  vec3 ldr = toL / max(dl, 0.001);
  float gazi = pow(clamp(dot(rd, ldr), 0.0, 1.0), 5.0);
  float lpow = pulse * 26.0 / (1.0 + 0.05 * dl * dl);
  vec3 coal  = mix(vec3(0.020, 0.014, 0.011), vec3(0.072, 0.049, 0.030), uShift * 0.55);
  vec3 ember = vec3(0.44, 0.21, 0.075) * (0.85 + 0.15 * pulse);
  vec3 fogCol = mix(coal, ember, clamp(gazi * min(lpow, 7.0) * 0.32, 0.0, 1.0));

  vec3 col;

  if (isHit) {
    vec3 p = ro + rd * t;
    vec3 n = calcN(p);

    vec3 lv = uLight - p;
    float ld = length(lv);
    vec3 ldir = lv / max(ld, 0.001);
    float atten = pulse * 10.0 / (1.0 + 0.075 * ld * ld);
    float dif = clamp(dot(n, ldir), 0.0, 1.0);
    float sh = 1.0;
    if (m != 2.0 && dif > 0.02 && ld < 20.0) {
      sh = softShadow(p + n * 0.03, ldir, min(ld - 0.1, 13.0));
    }
    float occ = ao(p, n);

    vec3 alb;
    if (m < 1.5) {
      float pat = n21(p.xz * 0.85);
      alb = mix(vec3(0.052, 0.047, 0.040), vec3(0.092, 0.074, 0.052), pat);
      alb = mix(alb, vec3(0.112, 0.096, 0.058), uShift * 0.5);   // патина земли
    } else if (m < 2.5) {
      float st = 0.5 + 0.5 * sin(p.y * 1.7 + n21(vec2(p.z * 0.21, 1.7)) * 5.0);
      alb = mix(vec3(0.058, 0.050, 0.040), vec3(0.105, 0.087, 0.064), st);
    } else {
      float v = n21(vec2(p.y * 0.7, p.z * 0.7 + p.x * 0.31));
      alb = mix(vec3(0.031, 0.029, 0.026), vec3(0.054, 0.048, 0.041), v);
    }

    vec3 lightCol = mix(vec3(1.0, 0.835, 0.596), vec3(1.0, 0.755, 0.44), uShift * 0.6);
    vec3 skyTop = mix(vec3(0.012, 0.010, 0.009), vec3(0.05, 0.035, 0.022), uAscend * 0.5);
    vec3 skyHz  = vec3(0.115, 0.055, 0.024) * (0.5 + uShift * 0.7 + uAscend * 2.2);
    vec3 amb = mix(skyHz, skyTop, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));

    vec3 lin = vec3(0.0);
    lin += lightCol * dif * atten * sh;
    lin += amb * (0.35 + 0.25 * occ);
    float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
    lin += vec3(0.36, 0.19, 0.085) * rim * (0.10 + uShift * 0.22 + uAscend * 0.4) * occ;
    vec3 hv = normalize(ldir - rd);
    float spec = pow(clamp(dot(n, hv), 0.0, 1.0), 26.0);
    lin += lightCol * spec * atten * sh * (m > 2.5 ? 0.55 : 0.18);

    col = alb * lin;

    // пластина-руна на грани монолита-носителя
    float sz2, sidx2, sdist2;
    nearestSigil(p.z, sz2, sidx2, sdist2);
    if (m > 3.5 && sdist2 < 3.0) {
      float side2 = mod(sidx2, 2.0) < 0.5 ? 1.0 : -1.0;
      if (dot(n, vec3(-side2, 0.0, 0.0)) > 0.55) {
        vec2 q = vec2(p.z - sz2, p.y - 2.45) / 0.62;
        float r = length(q);
        if (r < 1.3) {
          float st = 0.0;
          for (int i = 0; i < 6; i++) {
            if (abs(uSigNear[i].z - sz2) < 0.6) st = clamp(uSigNear[i].w, 0.0, 1.0);
          }
          float pat = runePattern(q, uTime + sidx2 * 3.1);
          vec3 glowC = mix(vec3(1.0, 0.58, 0.20), vec3(0.98, 0.88, 0.65), st);
          float inten = mix(3.1 + 0.9 * sin(uTime * 2.1 + sz2 * 0.1), 0.95, st);
          col += glowC * pat * inten;
          col += glowC * 0.16 * exp(-3.2 * r * r) * inten;
        }
      }
    }

    float fogAmt = 1.0 - exp(-t * 0.030 * uFogDens);
    col = mix(col, fogCol, fogAmt);
  } else {
    col = skyCol(rd);
    col = mix(col, fogCol, clamp(1.0 - rd.y * 3.2, 0.0, 1.0) * 0.92);
  }

  // маяки сигилов: свечение в тумане по ближайшей точке луча
  for (int i = 0; i < 6; i++) {
    vec4 sg = uSigNear[i];
    if (sg.w < -0.5) continue;
    float tc = clamp(dot(sg.xyz - ro, rd), 0.0, tGlow);
    float dd = length(ro + rd * tc - sg.xyz);
    float base = mix(1.15, 0.42, clamp(sg.w, 0.0, 1.0));
    float puls = 0.82 + 0.22 * sin(uTime * 1.9 + sg.z * 0.07);
    vec3 gc = mix(vec3(1.0, 0.52, 0.18), vec3(0.95, 0.82, 0.58), clamp(sg.w, 0.0, 1.0));
    col += gc * base * puls / (1.0 + dd * dd * 0.055) * exp(-tc * 0.021 * uFogDens);
  }

  // виньетка -> ACES -> гамма -> дизеринг
  vec2 vq = gl_FragCoord.xy / uRes;
  col *= 0.66 + 0.34 * pow(16.0 * vq.x * vq.y * (1.0 - vq.x) * (1.0 - vq.y), 0.20);
  col = aces(col * 1.30);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h11(dot(gl_FragCoord.xy, vec2(0.167, 0.321)) + uTime) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`
