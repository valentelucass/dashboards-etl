import { memo, type CSSProperties, type ReactNode } from 'react';

// All three faces share the same projection so the truck stays on the loading lane.
const project = (x: number, y: number, z = 0) => [300 + (x - y) * .88, 225 + (x + y) * .43 - z];
const point = (x: number, y: number, z = 0) => project(x, y, z).join(',');
const sceneView = { x: 22, y: 8, width: 625, height: 410 };
const viewBox = Object.values(sceneView).join(' ');

function Vehicle({ kind, bounds, children }: {
  kind: 'truck' | 'forklift' | 'van';
  bounds: [number, number, number, number];
  children: ReactNode;
}) {
  const [x, y, width, height] = bounds;
  const style: CSSProperties & { '--dx': string; '--dy': string } = {
    left: `${100 * (x - sceneView.x) / sceneView.width}%`, top: `${100 * (y - sceneView.y) / sceneView.height}%`,
    width: `${100 * width / sceneView.width}%`, height: `${100 * height / sceneView.height}%`,
    '--dx': `${100 / width}%`, '--dy': `${100 / height}%`,
  };
  return <div className={`login-dock-vehicle login-dock-${kind}`} style={style}>
    <svg viewBox={bounds.join(' ')} focusable="false">{children}</svg>
  </div>;
}

function Box({ x, y, z = 0, width, depth, height, colors }: {
  x: number; y: number; z?: number; width: number; depth: number; height: number;
  colors: [top: string, front: string, side: string];
}) {
  const right = x + width, front = y + depth, top = z + height;
  return <g>
    <polygon fill={colors[1]} points={[point(x, front, z), point(right, front, z), point(right, front, top), point(x, front, top)].join(' ')} />
    <polygon fill={colors[2]} points={[point(right, y, z), point(right, front, z), point(right, front, top), point(right, y, top)].join(' ')} />
    <polygon fill={colors[0]} points={[point(x, y, top), point(right, y, top), point(right, front, top), point(x, front, top)].join(' ')} />
  </g>;
}

function Bay({ x, number }: { x: number; number: string }) {
  const [left, top] = project(x, -59, 67);
  return <g transform={`matrix(.88 .43 0 1 ${left} ${top})`}>
    <rect x="-4" y="-5" width="81" height="72" rx="1" fill="var(--dock-glass)" />
    <svg width="73" height="67" viewBox="0 0 73 67" overflow="hidden">
      <rect width="73" height="67" fill="#23343e" />
      <g className={number === '04' ? 'login-dock-shutter' : undefined}>
        <rect width="73" height="62" fill="var(--dock-steel)" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M0 ${6 + i * 7}h73`} stroke="#526d76" />)}
        <path d="M0 61h73" stroke="#3f555e" strokeWidth="2" />
      </g>
    </svg>
    <rect x="20" y="-23" width="26" height="15" rx="2" fill="#49636a" />
    <text x="33" y="-12" textAnchor="middle" fill="#ecf2e1" fontFamily="monospace" fontSize="10">{number}</text>
    <circle cx="67" cy="-12" r="2.5" fill="var(--color-warning-fill)" />
    {number === '04' && <circle className="login-dock-signal" cx="67" cy="-12" r="3.2" fill="var(--color-positive-fill)" />}
  </g>;
}

export default memo(function LoginDockScene() {
  return <div className="login-dock-scene" aria-hidden="true">
    <svg className="login-dock-layer login-dock-road-layer" viewBox={viewBox} focusable="false">
    <defs>
      <linearGradient id="login-dock-headlights" x1="1" y1="0" x2="0" y2="1">
        <stop stopColor="#ffedb1" stopOpacity=".42" /><stop offset="1" stopColor="#ffe7a2" stopOpacity="0" />
      </linearGradient>
      <pattern id="login-dock-ribs" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M1 0v8" stroke="#58767b" strokeWidth=".9" />
      </pattern>
    </defs>
    <g className="login-dock-roads">
      <polygon points={[point(1,130),point(80,130),point(80,6500),point(1,6500)].join(' ')} />
      {[4,77].map(x => <path key={x} d={`M${point(x,139)} L${point(x,6500)}`} />)}
      <polygon points={[point(-6500,266),point(6500,266),point(6500,336),point(-6500,336)].join(' ')} />
      <path d={`M${point(-6500,301)} L${point(6500,301)}`} strokeDasharray="12 12" />
      {[-10,91].map((x,i) => <path key={x} d={`M${point(x,267)} L${point(i ? 6500 : -6500,267)}`} />)}
      <path d={`M${point(-6500,335)} L${point(6500,335)}`} />
    </g>
    </svg>
    <svg className="login-dock-layer" viewBox={viewBox} focusable="false">
    <Box x={-145} y={-105} z={-6} width={400} depth={245} height={6} colors={['var(--dock-paving)','var(--color-bg)','var(--color-bg)']} />
    {Array.from({ length: 9 }, (_, i) => <polygon key={i} fill="#bdcc9b" points={[
      point(-130+i*43,133),point(-108+i*43,133),point(-108+i*43,135),point(-130+i*43,135),
    ].join(' ')} />)}
    {Array.from({length:6},(_,i)=><polygon key={i} fill="#abc0b3" opacity=".7" points={[
      point(83,201+i*5),point(103,201+i*5),point(103,203+i*5),point(83,203+i*5),
    ].join(' ')} />)}
    <Box x={-110} y={-127} width={346} depth={66} height={101} colors={['var(--dock-roof)','var(--dock-siding)','var(--dock-shade)']} />
    <g transform={`matrix(.88 .43 0 1 ${project(-110,-61,99).join(' ')})`}>
      <rect width="346" height="98" fill="url(#login-dock-ribs)" />
    </g>
    <Bay x={-95} number="03" /><Bay x={2} number="04" /><Bay x={109} number="05" />
    <Box x={-115} y={-131} z={99} width={355} depth={76} height={5} colors={['var(--dock-roof)','var(--dock-siding)','var(--dock-steel)']} />
    {[108,142].map(x => <Box key={x} x={x} y={-113} z={104} width={23} depth={13} height={7} colors={['#90a7a5','#829998','#687f84']} />)}
    {[-100, 2, 106, 214].map(x => <Box key={x} x={x} y={-46} width={4} depth={4} height={17} colors={['#f6dfa3','#d6b575','#ae9466']} />)}
    {[[-109,112],[244,73]].map(([x,y])=>{const [cx,cy]=project(x,y);return <g key={x}>
      <ellipse cx={cx} cy={cy} rx="12" ry="4" fill="#344954" />
      <path d={`M${cx} ${cy}v-34l7 -3`} fill="none" stroke="#81989b" strokeWidth="2" />
      <ellipse cx={cx+7} cy={cy-37} rx="4" ry="1.7" fill="#e9dfa8" />
    </g>;})}
    {[[-98,26],[-78,21],[195,60],[180,87]].map(([x,y]) =>
      <Box key={x} x={x} y={y} width={17} depth={17} height={14} colors={['#d4b18a','#aa8970','#bc9978']} />)}
    </svg>
    <Vehicle kind="truck" bounds={[112, 160, 254, 196]}>
      {[17,55].map(x=><polygon key={x} points={[point(x-2,132,14),point(x+2,132,14),point(x+14,204),point(x-13,204)].join(' ')} fill="url(#login-dock-headlights)" />)}
      <polygon fill="#263943" opacity=".65" points={[point(13,0),point(71,0),point(72,148),point(13,148)].join(' ')} />
      <Box x={13} y={1} z={6} width={49} depth={137} height={8} colors={['#45565b','#37464b','#26363c']} />
      <Box x={12} y={0} z={12} width={51} depth={91} height={47} colors={['var(--dock-trailer)','var(--dock-siding)','var(--dock-roof)']} />
      {Array.from({ length: 17 }, (_, i) => <line key={i} x1={project(63,i*5.3,14)[0]} y1={project(63,i*5.3,14)[1]}
        x2={project(63,i*5.3,55)[0]} y2={project(63,i*5.3,55)[1]} stroke="#97b0ab" strokeWidth="1.1" />)}
      <Box x={13} y={94} z={9} width={50} depth={38} height={32} colors={['var(--dock-cab-top)','var(--dock-cab-front)','var(--dock-cab-side)']} />
      <polygon points={[point(17,132,24),point(59,132,24),point(59,132,36),point(17,132,36)].join(' ')} fill="#374d5a" />
      <polygon points={[point(63,99,24),point(63,126,24),point(63,126,36),point(63,99,36)].join(' ')} fill="#4a626b" />
      {[9,24,112].map(y => {const [cx,cy] = project(63,y,9); return <g key={y}>
        <ellipse cx={cx} cy={cy} rx="4.7" ry="7" fill="#22343e" /><circle cx={cx} cy={cy} r="2" fill="#879997" />
      </g>;})}
      {[17,56].map(x => { const [cx,cy] = project(x,132,16);return <circle key={x} cx={cx} cy={cy} r="2.2" fill="#fff4c1" />; })}
    </Vehicle>
    {/* The forklift and gatehouse are on the near side of the truck lane. */}
    <Vehicle kind="forklift" bounds={[418, 240, 95, 76]}>
      {/* Paint the load behind the mast. Its pallet rests on both tines at every lift height. */}
      <g className="login-dock-forks">
        {[-27, -17].map(y => <Box key={y} x={132} y={y} z={2} width={34} depth={2} height={2}
          colors={['#b3c1ca', '#7f909a', '#6b7c86']} />)}
        <Box x={135} y={-29} z={4} width={15} depth={16} height={2} colors={['#b89569', '#866947', '#987750']} />
        <Box x={136} y={-28} z={6} width={12} depth={13} height={12} colors={['#e0bc91', '#ae8b6b', '#bf9c7a']} />
        <polygon fill="#ebd4ae" points={[point(141,-28,18),point(143,-28,18),point(143,-15,18),point(141,-15,18)].join(' ')} />
      </g>
      <Box x={165} y={-29} width={3} depth={16} height={29} colors={['#879aa4', '#455660', '#364650']} />
      <Box x={168} y={-29} z={4} width={28} depth={16} height={9} colors={['#efb66b', '#c38b4b', '#b87c40']} />
      <Box x={186} y={-29} z={13} width={10} depth={16} height={4} colors={['#f1bc74', '#bf8647', '#aa713b']} />
      {[[-28, 170], [-28, 183], [-15, 170], [-15, 183]].map(([y,x]) =>
        <Box key={`${x}-${y}`} x={x} y={y} z={13} width={2} depth={2} height={13} colors={['#84949f', '#455660', '#334550']} />)}
      <Box x={169} y={-30} z={26} width={18} depth={18} height={2} colors={['#687b88', '#435660', '#354650']} />
      {[172, 191].map(x => { const [cx,cy]=project(x,-13,4); return <g key={x}>
        <circle cx={cx} cy={cy} r="4" fill="#23343e" /><circle cx={cx} cy={cy} r="1.5" fill="#81919c" />
      </g>; })}
    </Vehicle>
    <svg className="login-dock-layer" viewBox={viewBox} focusable="false">
    <Box x={97} y={144} width={24} depth={19} height={21} colors={['#adc2b7','#78918d','#638089']} />
    <Box x={95} y={142} z={21} width={28} depth={23} height={2} colors={['#bcccc1','#849b97','#6f898d']} />
    <polygon points={[point(100,163,11),point(118,163,11),point(118,163,18),point(100,163,18)].join(' ')} fill="#3c5a64" />
    <g transform={`translate(${project(93,153).join(' ')})`}>
      <path d="M0 0v-13" stroke="var(--dock-shade)" strokeWidth="3"/>
      <g transform="translate(0 -13)"><g className="login-dock-gate">
        <path d="M0 0l-40 -19" stroke="var(--dock-roof)" strokeWidth="3"/>
        <path d="M0 0l-40 -19" stroke="var(--color-primary)" strokeWidth="3" strokeDasharray="5 5"/>
      </g></g>
    </g>
    </svg>
    <Vehicle kind="van" bounds={[6, 307, 60, 55]}>
      <Box x={-35} y={277} z={3} width={27} depth={16} height={14} colors={['#cad8cf','#8ca8a8','#86a0a1']} />
      <Box x={-8} y={277} z={3} width={11} depth={16} height={10} colors={['#a7c5bc','#8eaaa8','#79999b']} />
      <polygon points={[point(-6,293,8),point(1,293,8),point(1,293,12),point(-6,293,12)].join(' ')} fill="#3d5965" />
      {[-29,-4].map(x=>{const [cx,cy]=project(x,293,3);return <circle key={x} cx={cx} cy={cy} r="2.5" fill="#2c404a" />;})}
    </Vehicle>
  </div>;
});
