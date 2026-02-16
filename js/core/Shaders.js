import { CONFIG } from './Config.js';

// Helper to format numeric constants into GLSL-friendly literals
const fmt = (val) => {
  // ensure decimals for GLSL floats
  if (Number.isInteger(val)) return val.toFixed(1);
  return String(val);
};

// Plug-ins of CONFIG values as numeric literals for shader strings
const CAUSTIC_TIME_FREQ = fmt(CONFIG.CAUSTIC_TIME_FREQ); // speed of caustic animation
const CAUSTIC_TAU = fmt(CONFIG.CAUSTIC_TAU); // 2*PI
const CAUSTIC_CELL_SCALE = fmt(CONFIG.CAUSTIC_CELL_SCALE);
const CAUSTIC_LIGHT_SHIFT = fmt(CONFIG.CAUSTIC_LIGHT_SHIFT);
const CAUSTIC_NORMAL_SHIFT = fmt(CONFIG.CAUSTIC_NORMAL_SHIFT);
const CAUSTIC_POWER = fmt(CONFIG.CAUSTIC_POWER);
const CAUSTIC_INTENSITY = fmt(CONFIG.CAUSTIC_INTENSITY);
const SPECULAR_POWER = fmt(CONFIG.SPECULAR_POWER);
const NORMAL_AMPLIFICATION = fmt(CONFIG.NORMAL_AMPLIFICATION);

export const SIM_VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const SIM_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_current;
uniform sampler2D u_previous;
uniform vec2 u_texelSize;
uniform float u_damping;
void main() {
  float c = texture2D(u_current, v_uv).r;
  float p = texture2D(u_previous, v_uv).r;
  float l = texture2D(u_current, v_uv + vec2(-u_texelSize.x, 0.0)).r;
  float r = texture2D(u_current, v_uv + vec2( u_texelSize.x, 0.0)).r;
  float t = texture2D(u_current, v_uv + vec2(0.0, -u_texelSize.y)).r;
  float b = texture2D(u_current, v_uv + vec2(0.0,  u_texelSize.y)).r;
  float next = (2.0 * c - p + 0.24 * (l + r + t + b - 4.0 * c)) * u_damping;
  gl_FragColor = vec4(next, 0.0, 0.0, 1.0);
}
`;

export const DISTURB_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_current;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_strength;
uniform vec2 u_direction;
void main() {
  float current = texture2D(u_current, v_uv).r;
  vec2 diff = v_uv - u_center;
  float dist = length(diff);
  float splash = u_strength * exp(-dist * dist / (u_radius * u_radius));
  float dirLen = length(u_direction);
  if (dirLen > 0.001) {
    splash *= 0.5 + 0.5 * dot(normalize(diff + 0.0001), u_direction / dirLen);
  }
  gl_FragColor = vec4(current + splash, 0.0, 0.0, 1.0);
}
`;

export const RENDER_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform vec3 u_sunPos;
uniform float u_time;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float causticPattern(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float minDist = 1.0;
  float minDist2 = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + 37.0));
      point = 0.5 + 0.5 * sin(u_time * ${CAUSTIC_TIME_FREQ} + ${CAUSTIC_TAU} * point);
      float d = length(neighbor + point - f);
      if (d < minDist) {
        minDist2 = minDist;
        minDist = d;
      } else if (d < minDist2) {
        minDist2 = d;
      }
    }
  }
  return minDist2 - minDist;
}

void main() {
  vec3 lightDir = normalize(u_sunPos);
  
  float h = texture2D(u_heightMap, v_uv).r;
  float hL = texture2D(u_heightMap, v_uv + vec2(-u_texelSize.x, 0.0)).r;
  float hR = texture2D(u_heightMap, v_uv + vec2( u_texelSize.x, 0.0)).r;
  float hD = texture2D(u_heightMap, v_uv + vec2(0.0, -u_texelSize.y)).r;
  float hU = texture2D(u_heightMap, v_uv + vec2(0.0,  u_texelSize.y)).r;
  
  // Normal calculation: N = (-df/dx, -df/dy, 1)
  vec3 normal = normalize(vec3(-(hR - hL) * ${NORMAL_AMPLIFICATION}, -(hU - hD) * ${NORMAL_AMPLIFICATION}, 1.0));
  
  // Blinn-Phong specular with view vector (0,0,1)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), ${SPECULAR_POWER});
  
  // Caustics shift based on light angle and refraction
  vec2 causticUV = (v_uv - lightDir.xy * ${CAUSTIC_LIGHT_SHIFT}) + normal.xy * ${CAUSTIC_NORMAL_SHIFT};
  float c = causticPattern(causticUV * ${CAUSTIC_CELL_SCALE});
  // Invert the pattern: (1.0 - c) makes boundaries bright.
  float caustics = pow(max(0.0, 1.0 - c), ${CAUSTIC_POWER}) * ${CAUSTIC_INTENSITY};
  
  vec3 deep = vec3(0.01, 0.04, 0.12);
  vec3 surf = vec3(0.06, 0.28, 0.45);
  vec3 water = mix(surf, deep, v_uv.y * 0.7 + 0.3);
  
  // Combine components
  vec3 color = water;
  color += spec * vec3(1.0, 0.95, 0.8) * 1.5; // Brighter specular
  color += caustics * vec3(0.8, 0.9, 1.0);    // Cool caustic tint
  color += h * 0.08;                         // Slight height-based luminance
  
  // Vignette
  float d = length(v_uv - 0.5);
  color *= smoothstep(0.9, 0.3, d);
  
  gl_FragColor = vec4(color, 1.0);
}
`;