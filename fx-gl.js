// Optional WebGL post-process for the desk scene (load with ?fx=gl): bloom around bright pixels, light shafts from
// the window, a shimmer on the river and a light colour grade, computed on the GPU from the 384x216 canvas of room.js.
(() => {
'use strict';
const src = document.getElementById('room');
const S = 2;                                             // output at 2x the native pixels so glows stay smooth
const out = document.createElement('canvas');
out.width = src.width * S; out.height = src.height * S;
out.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;image-rendering:pixelated';
const gl = out.getContext('webgl', { premultipliedAlpha: false, antialias: false });
if (!gl) return;
src.after(out); src.style.opacity = '0';

const vs = 'attribute vec2 p; varying vec2 uv; void main() { uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
const fs = `precision mediump float;
varying vec2 uv; uniform sampler2D t; uniform vec2 res; uniform vec2 sun; uniform float time;
vec3 tx(vec2 q) { return texture2D(t, q).rgb; }
void main() {
  vec2 px = 1. / res, q = uv;
  vec2 n = vec2(uv.x * res.x, (1. - uv.y) * res.y);                 // native pixel coordinates, y down
  if (n.x > 48. && n.x < 432. && n.y > 128. && n.y < 160.)            // the river: a slow horizontal shimmer
    q.x += sin(n.y * 1.7 + time * 1.6) * .6 * px.x;
  vec3 base = tx(q);
  vec3 b = vec3(0.);                                                  // bloom: a ring of taps around the pixel
  for (int i = 0; i < 12; i++) {
    float a = float(i) * .5236;
    for (int j = 1; j < 4; j++) { vec3 c = tx(q + vec2(cos(a), sin(a)) * float(j) * 2. * px); b += max(c - .66, 0.) / float(j); }
  }
  b /= 12.;
  vec3 r = vec3(0.); vec2 d = (q - sun) / 36.; vec2 s = q; float w = 1.;   // light shafts: march towards the window
  for (int i = 0; i < 36; i++) { s -= d; r += max(tx(s) - .58, 0.) * w; w *= .95; }
  r /= 36.;
  vec3 col = base + b * .6 + r * 1.2;
  col = mix(col, col * vec3(1.05, 1., .94), .5);                      // warm the highlights a little
  col = mix(vec3(dot(col, vec3(.299, .587, .114))), col, 1.08);        // a touch more saturation
  gl_FragColor = vec4(col, 1.);
}`;
const sh = (type, code) => { const o = gl.createShader(type); gl.shaderSource(o, code); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
const U = n => gl.getUniformLocation(prog, n);
gl.uniform2f(U('res'), src.width, src.height);
gl.uniform2f(U('sun'), 240 / src.width, 1 - 100 / src.height);   // centre of the glass wall         // centre of the window
gl.viewport(0, 0, out.width, out.height);

function frame(now) {
  requestAnimationFrame(frame);
  if (getComputedStyle(src.parentElement).display === 'none') return;
  // follow the zoom and pan that room.js applies to its canvas
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(src.style.transform);
  if (m) out.style.transform = `translate(${m[1]}px,${m[2]}px) scale(${(+m[3] / S).toFixed(4)})`;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.uniform1f(U('time'), now / 1000);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
requestAnimationFrame(frame);
})();
