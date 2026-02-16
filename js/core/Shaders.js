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

void main() {
  float h = texture2D(u_heightMap, v_uv).r;
  float hL = texture2D(u_heightMap, v_uv + vec2(-u_texelSize.x, 0.0)).r;
  float hR = texture2D(u_heightMap, v_uv + vec2( u_texelSize.x, 0.0)).r;
  float hT = texture2D(u_heightMap, v_uv + vec2(0.0, -u_texelSize.y)).r;
  float hB = texture2D(u_heightMap, v_uv + vec2(0.0,  u_texelSize.y)).r;
  
  vec3 normal = normalize(vec3(-(hR - hL) * 5.0, -(hB - hT) * 5.0, 1.0));
  vec3 lightDir = normalize(u_sunPos);
  float spec = pow(max(dot(normal, normalize(lightDir + vec3(0,0,1))), 0.0), 64.0);
  
  vec3 deep = vec3(0.01, 0.04, 0.1);
  vec3 surf = vec3(0.05, 0.25, 0.4);
  vec3 water = mix(surf, deep, v_uv.y * 0.8 + 0.2);
  
  vec3 color = water + spec * vec3(1.0, 0.9, 0.7) + h * 0.05;
  
  // Vignette
  float d = length(v_uv - 0.5);
  color *= smoothstep(0.8, 0.2, d);
  
  gl_FragColor = vec4(color, 1.0);
}
`;