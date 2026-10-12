/**
 * Л·03 «SDF-ПЛОЩАДКА» — raymarching одной сценой: сфера + бокс + тор.
 *
 * Один фрагментный шейдер прошупывает пространство лучами: расстояния до
 * тел считает signed distance functions, тела слеплены мягким smin(k),
 * тень — мягкая (по мере затенения вдоль луча к свету), воздух — туман.
 * Селектор «шаги» честно показывает, как качество покупается ценой кадров.
 */

import { createFullscreenGL, type GLProgramHandle, type FullscreenGL } from '@/lib/lab/glkit'
import { numParam, strParam, type DemoInstance, type DemoModule } from '@/lib/lab/types'

const FRAG = `
uniform vec2 uRes;
uniform float uTime;
uniform float uK;    // smin weld viscosity
uniform float uRot;  // scene rotation, radians
uniform int uSteps;  // ray steps
uniform int uShadow; // soft shadow on/off

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Distance map: sphere + box + torus welded by smin, plus the floor plane.
float map(vec3 p) {
  p.xz = rot2(uRot) * p.xz;
  vec3 q = p;
  q.y += 0.06 * sin(uTime * 0.8);          // gentle breathing
  float sph = sdSphere(q - vec3(0.0, 0.5, 0.0), 0.52);
  float box = sdBox(q - vec3(0.0, -0.12, 0.0), vec3(0.6, 0.32, 0.6));
  float tor = sdTorus(q - vec3(0.0, -0.68, 0.0), vec2(0.56, 0.16));
  float blob = smin(sph, smin(box, tor, uK), uK);
  return min(blob, p.y + 1.32);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.0016;
  return normalize(vec3(
    map(p + vec3(e, 0.0, 0.0)) - map(p - vec3(e, 0.0, 0.0)),
    map(p + vec3(0.0, e, 0.0)) - map(p - vec3(0.0, e, 0.0)),
    map(p + vec3(0.0, 0.0, e)) - map(p - vec3(0.0, 0.0, e))
  ));
}

// Soft shadow: light smears out as the occluder blocks the ray.
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.04;
  for (int i = 0; i < 20; i++) {
    float h = map(ro + rd * t);
    res = min(res, 14.0 * h / t);
    t += clamp(h, 0.03, 0.4);
    if (res < 0.004 || t > 7.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

// Background: warm graphite gradient with a vignette.
vec3 bgColor(vec2 uv) {
  vec3 top = vec3(0.078, 0.068, 0.055);
  vec3 bot = vec3(0.045, 0.038, 0.032);
  vec3 c = mix(bot, top, clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));
  c *= 1.0 - 0.42 * dot(uv, uv); // vignette
  return c;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;

  vec3 ro = vec3(0.0, 0.62, 3.35);
  vec3 rd = normalize(vec3(uv, -1.55));

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 128; i++) {
    if (i >= uSteps) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0012 * (1.0 + t)) { hit = true; break; }
    t += d;
    if (t > 9.0) break;
  }

  vec3 col = bgColor(uv);

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    bool isFloor = p.y < -1.31;

    vec3 lig = normalize(vec3(2.1, 2.8, 1.5));   // amber key light
    vec3 fil = normalize(vec3(-2.4, 0.7, -1.2)); // plum fill light

    float dif = max(dot(n, lig), 0.0);
    float sh = uShadow == 1 ? softShadow(p + n * 0.01, lig) : 1.0;
    float amb = 0.5 + 0.5 * n.y;
    float bac = max(dot(n, fil), 0.0);
    float fre = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 3.0);
    vec3 hal = normalize(lig - rd);
    float spe = pow(clamp(dot(n, hal), 0.0, 1.0), 40.0);

    vec3 mat = isFloor
      ? vec3(0.10, 0.088, 0.072)  // graphite floor
      : vec3(0.62, 0.52, 0.38);   // warm bone

    if (isFloor) {
      // sparse grid on the floor: cheap depth cue
      vec2 g = abs(fract(p.xz * 1.6) - 0.5);
      float line = smoothstep(0.46, 0.5, max(g.x, g.y));
      mat += line * 0.045;
    }

    col = mat * vec3(1.0, 0.78, 0.5) * dif * sh * 2.2;   // key light
    col += mat * vec3(0.42, 0.16, 0.36) * bac * 0.9;     // plum fill
    col += mat * amb * vec3(0.16, 0.14, 0.12);           // ambient
    col += vec3(1.0, 0.85, 0.6) * spe * sh * dif * 0.9;  // specular
    col += fre * vec3(0.9, 0.75, 0.55) * 0.35;           // fresnel rim

    float fog = smoothstep(2.2, 8.5, t);
    col = mix(col, bgColor(uv), fog);
  }

  // dithering to kill banding in the fog
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}
`

export const sdfDemo: DemoModule = {
  id: 'sdf',
  title: 'SDF-площадка',
  latin: 'SDF PLAYGROUND',
  category: 'shaders',
  description:
    'Один фрагментный шейдер прошупывает сцену лучами: сфера, бокс и тор слеплены мягким smin — ползунок k управляет «вязкостью» сварки. Переключатель шагов честно показывает, как raymarching покупает качество ценой кадров.',
  tech: 'webgl2 · raymarch · sdSphere / sdBox / sdTorus · smin · soft shadow · fog',
  params: [
    { key: 'k', label: 'Смешивание k', kind: 'range', min: 0.04, max: 1.2, step: 0.01, value: 0.34 },
    { key: 'rot', label: 'Поворот сцены', kind: 'range', min: -180, max: 180, step: 1, value: 34 },
    {
      key: 'steps',
      label: 'Шаги луча',
      kind: 'select',
      value: '64',
      options: [
        { value: '48', label: '48' },
        { value: '64', label: '64' },
        { value: '96', label: '96' },
      ],
    },
    { key: 'shadow', label: 'Мягкая тень', kind: 'toggle', value: true },
  ],
  create(canvas, params, opts) {
    // Фолбэк без WebGL2: честная надпись вместо чёрной дыры.
    const gl: FullscreenGL | null = createFullscreenGL(canvas)
    if (!gl) {
      const ctx = canvas.getContext('2d')
      const paint = (): void => {
        if (!ctx) return
        const w = Math.max(1, canvas.clientWidth)
        const h = Math.max(1, canvas.clientHeight)
        ctx.fillStyle = '#100e0c'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#8b8175'
        ctx.font = '11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('WebGL2 недоступен — прибору нужен GPU', w / 2, h / 2)
      }
      paint()
      return { frame: paint, setParam: () => {}, destroy: () => {} }
    }

    let prog: GLProgramHandle
    try {
      prog = gl.program(FRAG)
    } catch (err) {
      console.error('lab/sdf:', err)
      return { frame: () => {}, setParam: () => {}, destroy: () => gl.dispose() }
    }

    let k = numParam(params, 'k', 0.34)
    let rot = numParam(params, 'rot', 34)
    let steps = parseInt(strParam(params, 'steps', '64'), 10)
    let shadow = params.shadow !== false

    const draw = (t: number): void => {
      gl.resize(720) // потолок буфера: тяжёлый шейдер рендерим компактно
      const glc = gl.gl
      glc.useProgram(prog.program)
      glc.uniform2f(prog.u('uRes')!, gl.size().width, gl.size().height)
      glc.uniform1f(prog.u('uTime')!, opts.reduced ? 4.2 : t)
      glc.uniform1f(prog.u('uK')!, k)
      glc.uniform1f(prog.u('uRot')!, (rot * Math.PI) / 180)
      glc.uniform1i(prog.u('uSteps')!, steps)
      glc.uniform1i(prog.u('uShadow')!, shadow ? 1 : 0)
      glc.drawArrays(glc.TRIANGLES, 0, 3)
    }

    draw(4.2)

    return {
      frame(t) {
        draw(t)
      },
      setParam(key, value) {
        if (key === 'k' && typeof value === 'number') k = value
        else if (key === 'rot' && typeof value === 'number') rot = value
        else if (key === 'steps' && typeof value === 'string') steps = parseInt(value, 10)
        else if (key === 'shadow' && typeof value === 'boolean') shadow = value
      },
      resize() {
        draw(opts.reduced ? 4.2 : 0)
      },
      destroy() {
        gl.dispose()
      },
    }
  },
}
