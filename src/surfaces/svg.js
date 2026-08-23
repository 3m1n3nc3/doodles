/**
 * SVG output. Works anywhere, including Node with no native dependencies.
 * The whole drawing API is four calls: path, clip, rect, background.
 */

const round = (n, p = 2) => {
  const v = Number(n.toFixed(p));
  return Object.is(v, -0) ? 0 : v;
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pathData(cmds, precision) {
  const out = [];
  for (const c of cmds) {
    if (c[0] === 'Z') { out.push('Z'); continue; }
    const nums = c.slice(1).map((n) => round(n, precision)).join(' ');
    out.push(c[0] + nums);
  }
  return out.join(' ');
}

function attrs(style) {
  const a = [];
  if (style.fill) {
    a.push(`fill="${style.fill}"`);
    if (style.alpha != null && style.alpha < 1) a.push(`fill-opacity="${round(style.alpha, 3)}"`);
    if (style.fillRule) a.push(`fill-rule="${style.fillRule}"`);
  } else {
    a.push('fill="none"');
  }
  if (style.stroke) {
    a.push(`stroke="${style.stroke}"`);
    a.push(`stroke-width="${round(style.width ?? 1, 2)}"`);
    if (style.alpha != null && style.alpha < 1) a.push(`stroke-opacity="${round(style.alpha, 3)}"`);
    if (style.cap) a.push(`stroke-linecap="${style.cap}"`);
    if (style.join) a.push(`stroke-linejoin="${style.join}"`);
    if (style.dash) a.push(`stroke-dasharray="${style.dash}"`);
  }
  return a.join(' ');
}

export class SVGSurface {
  constructor({ width = 400, height = 500, background = null, precision = 1, paper = false } = {}) {
    this.width = width;
    this.height = height;
    this.precision = precision;
    this.out = [];
    this.defs = [];
    this._clipId = 0;
    this._bg = background;
    this._paper = paper;
  }

  path(cmds, style) {
    if (!cmds || !cmds.length) return;
    const d = pathData(cmds, this.precision);
    if (!d) return;
    this.out.push(`<path d="${d}" ${attrs(style)}/>`);
  }

  clip(cmds, fn) {
    const id = `c${this._clipId++}`;
    this.defs.push(`<clipPath id="${id}"><path d="${pathData(cmds, this.precision)}"/></clipPath>`);
    this.out.push(`<g clip-path="url(#${id})">`);
    fn();
    this.out.push('</g>');
  }

  rect(x, y, w, h, style) {
    this.out.push(`<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" ${attrs(style)}/>`);
  }

  group(transform, fn) {
    this.out.push(`<g transform="${esc(transform)}">`);
    fn();
    this.out.push('</g>');
  }

  background(color) { this._bg = color; }

  /** Aged-paper grain, done with a filter so the file stays tiny. */
  paperTexture(opts = {}) {
    const { opacity = 0.5, freq = 0.9, octaves = 2, seed = 3 } = opts;
    this.defs.push(
      `<filter id="grain" x="0" y="0" width="100%" height="100%">`
      + `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="n"/>`
      + `<feColorMatrix in="n" type="saturate" values="0"/>`
      + `</filter>`,
    );
    this._grain = opacity;
  }

  toString() {
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" `
      + `viewBox="0 0 ${this.width} ${this.height}">`;
    const bg = this._bg ? `<rect width="100%" height="100%" fill="${this._bg}"/>` : '';
    const grain = this._grain
      ? `<rect width="100%" height="100%" filter="url(#grain)" opacity="${this._grain}" style="mix-blend-mode:multiply"/>`
      : '';
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    return `${head}${defs}${bg}${this.out.join('')}${grain}</svg>`;
  }
}

export default SVGSurface;
