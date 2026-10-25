import { memo } from 'react';
import type { PartArt } from '@/lib/anatomy/geometry';

function tint(hex: string, amount: number): string {
  const full = hex.replace('#', '');
  const rgb = full.length === 3 ? full.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  return `rgb(${rgb.map(n => Math.round(amount >= 0 ? n + (255 - n) * amount : n * (1 + amount))).join(' ')})`;
}

/** The path layering is adapted from Anatomy kit/react/draw.tsx (MIT).
 * The upstream kit generates every actual extrusion and bevel used here. */
function HardwareArt({ art }: { art: PartArt }) {
  return <g className="anatomy-hardware-art" pointerEvents="none">
    {art.marks.map(mark => {
      if (mark.kind === 'line') return <path key={mark.key} d={mark.path} fill="none" stroke={mark.colour} strokeWidth={mark.width} opacity={mark.opacity} strokeLinecap="round" strokeLinejoin="round" />;
      if (mark.kind === 'text') return <text key={mark.key} transform={mark.transform} fontSize={mark.size} fill={mark.colour} fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing=".05">{mark.text}</text>;
      const p = mark.paths;
      return <g key={mark.key} opacity={mark.opacity}>
        <path d={p.fill} fill={tint(mark.colour, -.24)} />
        {p.shades.map((path, i) => path ? <path key={i} d={path} fill={tint(mark.colour, [-.28, -.16, -.06, .04][i])} /> : null)}
        <path d={p.top} fill={mark.colour} />
        {p.crease && <path d={p.crease} fill="none" stroke={tint(mark.colour, -.26)} strokeWidth=".2" />}
        {p.bevel && <path d={p.bevel} fill="none" stroke={tint(mark.colour, .28)} strokeWidth=".3" />}
        <path d={p.outline} fill="none" stroke={tint(mark.colour, -.42)} strokeWidth=".22" strokeLinejoin="round" />
      </g>;
    })}
  </g>;
}
export default memo(HardwareArt);
