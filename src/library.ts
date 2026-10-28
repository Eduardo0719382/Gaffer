// Librería de equipos. Los valores son APROXIMADOS (consumo, ángulo, lux) y se pueden
// editar en cada luz. Los nombres de marca/modelo son solo texto descriptivo.
import {
  CatalogItem, Fixture, FixtureType, makeActor, makeCamera, makeDoor, makeLight,
  makeModifier, makePower, makeProp, makeText, makeWall, makeWindow,
} from './model';

// Lux a 1 m por watt, según tipo (estimación para el cálculo de lux).
const LUX_PER_WATT: Record<FixtureType, number> = {
  cob: 55, fresnel: 6, panel: 8, tube: 10, hmi: 30, practical: 1.5, mini: 40, sun: 0,
};

type Row = [brand: string, model: string, type: FixtureType, watts: number, beam: number, cctMin: number, cctMax: number, rgb?: boolean];

const ROWS: Row[] = [
  ['Aputure', 'LS 1200d Pro', 'cob', 1440, 55, 5600, 5600],
  ['Aputure', 'LS 600d Pro', 'cob', 720, 55, 5600, 5600],
  ['Aputure', 'LS 600x Pro', 'cob', 720, 55, 2700, 6500],
  ['Aputure', 'LS 300d II', 'cob', 350, 55, 5600, 5600],
  ['Aputure', 'LS 300x', 'cob', 350, 55, 2700, 6500],
  ['Aputure', 'Nova P300c', 'panel', 360, 120, 2300, 10000, true],
  ['Aputure', 'MC (mini RGB)', 'mini', 5, 60, 3200, 6500, true],
  ['Aputure', 'INFINIBAR PB12', 'tube', 60, 160, 2000, 10000, true],
  ['Amaran', '200d', 'cob', 230, 55, 5600, 5600],
  ['Amaran', '100x', 'cob', 130, 55, 2700, 6500],
  ['Amaran', 'F22c (flex 2x2)', 'panel', 200, 120, 2500, 7500, true],
  ['Nanlite', 'Forza 60', 'cob', 88, 55, 5600, 5600],
  ['Nanlite', 'Forza 300B', 'cob', 350, 55, 2700, 6500],
  ['Nanlite', 'Forza 500', 'cob', 580, 55, 5600, 5600],
  ['Nanlite', 'PavoTube II 30X', 'tube', 40, 160, 2700, 12000, true],
  ['Nanlite', 'PavoSlim 120C', 'panel', 120, 110, 2700, 7500, true],
  ['Arri', 'SkyPanel S30-C', 'panel', 200, 110, 2800, 10000, true],
  ['Arri', 'SkyPanel S60-C', 'panel', 450, 110, 2800, 10000, true],
  ['Arri', 'SkyPanel S360-C', 'panel', 1500, 110, 2800, 10000, true],
  ['Arri', 'Orbiter', 'cob', 500, 50, 2000, 20000, true],
  ['Arri', 'M18 (HMI)', 'hmi', 1800, 40, 5600, 5600],
  ['Godox', 'SL60W', 'cob', 60, 55, 5600, 5600],
  ['Godox', 'VL150', 'cob', 150, 55, 5600, 5600],
  ['Godox', 'VL300', 'cob', 300, 55, 5600, 5600],
  ['Godox', 'TL60 (tubo)', 'tube', 20, 160, 2700, 6500, true],
  ['Kino Flo', 'Celeb 250', 'panel', 250, 110, 2700, 6500, true],
  ['Kino Flo', 'Diva-Lite 401', 'panel', 220, 110, 3200, 5600],
  ['Astera', 'Titan Tube', 'tube', 48, 160, 1750, 20000, true],
  ['Litepanels', 'Gemini 2x1', 'panel', 350, 110, 2700, 10000, true],
  ['Genérico', 'Fresnel tungsteno 650 W', 'fresnel', 650, 40, 3200, 3200],
  ['Genérico', 'Fresnel tungsteno 1 kW', 'fresnel', 1000, 40, 3200, 3200],
  ['Genérico', 'Fresnel tungsteno 2 kW', 'fresnel', 2000, 40, 3200, 3200],
  ['Genérico', 'Fresnel tungsteno 5 kW', 'fresnel', 5000, 40, 3200, 3200],
  ['Genérico', 'Fresnel tungsteno 10 kW', 'fresnel', 10000, 40, 3200, 3200],
  ['Genérico', 'Open face 1 kW', 'cob', 1000, 60, 3200, 3200],
  ['Genérico', 'Open face 2 kW', 'cob', 2000, 60, 3200, 3200],
  ['Genérico', 'HMI PAR 575 W', 'hmi', 640, 30, 5600, 5600],
  ['Genérico', 'HMI PAR 1.2 kW', 'hmi', 1300, 30, 5600, 5600],
  ['Genérico', 'HMI 4 kW', 'hmi', 4400, 30, 5600, 5600],
  ['Genérico', 'HMI 18 kW', 'hmi', 19000, 30, 5600, 5600],
  ['Genérico', 'Panel LED 1x1', 'panel', 100, 110, 3200, 5600],
  ['Genérico', 'Tubo LED 4 ft', 'tube', 40, 160, 2700, 6500, true],
  ['Genérico', 'Práctica (foco 60 W)', 'practical', 60, 300, 2700, 2700],
  ['Genérico', 'Sol / luz de luna', 'sun', 0, 12, 5600, 5600],
];

export function fixtureId(brand: string, model: string): string {
  return (brand + '-' + model).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function fixtureFrom(brand: string, model: string, type: FixtureType, watts: number, beam: number, cctMin: number, cctMax: number, rgb = false, custom = false): Fixture {
  return {
    id: fixtureId(brand, model), brand, model, type, watts, beamAngle: beam,
    lux1m: Math.round(watts * LUX_PER_WATT[type]), cctMin, cctMax, rgb, custom,
  };
}

export const FIXTURES: Fixture[] = ROWS.map(r => fixtureFrom(...r));

export const FIXTURE_TYPE_NAMES: Record<FixtureType, string> = {
  cob: 'COB / reflector', fresnel: 'Fresnel', panel: 'Panel', tube: 'Tubo',
  hmi: 'HMI', practical: 'Práctica', mini: 'Mini', sun: 'Sol / natural',
};

export interface Category { id: string; name: string; items: CatalogItem[] }

function lightItem(f: Fixture): CatalogItem {
  return { key: 'light:' + f.id, name: `${f.brand} ${f.model}`, hint: f.watts ? `${f.watts} W` : '', make: () => makeLight(f) };
}

export function buildCatalog(custom: Fixture[]): Category[] {
  const brands = Array.from(new Set(FIXTURES.map(f => f.brand)));
  const cats: Category[] = [];
  if (custom.length) cats.push({ id: 'mine', name: 'Mis equipos', items: custom.map(lightItem) });
  for (const b of brands) cats.push({ id: 'b:' + b, name: `Luces · ${b}`, items: FIXTURES.filter(f => f.brand === b).map(lightItem) });
  cats.push({
    id: 'grip', name: 'Grip y modificadores', items: [
      { key: 'm:softbox', name: 'Softbox', hint: '0.9 m', make: () => makeModifier('softbox', 0.35, 0.9, 'Softbox', 'Difusión') },
      { key: 'm:lantern', name: 'Lantern / chimera', hint: '0.65 m', make: () => makeModifier('lantern', 0.65, 0.65, 'Lantern') },
      { key: 'm:66', name: 'Marco 6x6', hint: '1.8 m', make: () => makeModifier('frame', 0.06, 1.8, '6x6', 'Full grid') },
      { key: 'm:88', name: 'Marco 8x8', hint: '2.4 m', make: () => makeModifier('frame', 0.06, 2.4, '8x8', 'Full grid') },
      { key: 'm:1212', name: 'Marco 12x12', hint: '3.6 m', make: () => makeModifier('frame', 0.06, 3.6, '12x12', 'Ultrabounce') },
      { key: 'm:diff', name: 'Marco de difusión 4x4', hint: '1.2 m', make: () => makeModifier('frame', 0.05, 1.2, '4x4', '216') },
      { key: 'm:bead', name: 'Bead board / foam', hint: 'rebote', make: () => makeModifier('bounce', 0.05, 1.2, 'Bead board', 'Bead board') },
      { key: 'm:flag', name: 'Bandera negra 24x36', hint: 'flag', make: () => makeModifier('flag', 0.04, 0.9, 'Bandera', 'Solid') },
      { key: 'm:floppy', name: 'Floppy 4x4', hint: 'flag', make: () => makeModifier('flag', 0.04, 1.2, 'Floppy', 'Solid') },
      { key: 'm:neg', name: 'Negativo 8x8', hint: 'negative fill', make: () => makeModifier('neg', 0.06, 2.4, 'Negativo', 'Duvetyne') },
      { key: 'm:net', name: 'Net / scrim', hint: 'atenúa', make: () => makeModifier('net', 0.04, 0.9, 'Net', 'Single net') },
    ],
  });
  cats.push({
    id: 'talent', name: 'Cámara y talento', items: [
      { key: 'cam', name: 'Cámara', hint: 'con campo de visión', make: () => makeCamera() },
      { key: 'actor', name: 'Actor / talento', make: () => makeActor() },
    ],
  });
  cats.push({
    id: 'props', name: 'Utilería', items: [
      { key: 'p:table', name: 'Mesa', hint: '1.2 x 0.8', make: () => makeProp('table', 1.2, 0.8, 'Mesa') },
      { key: 'p:round', name: 'Mesa redonda', hint: 'Ø 1 m', make: () => makeProp('round', 1, 1, 'Mesa') },
      { key: 'p:chair', name: 'Silla', make: () => makeProp('chair', 0.45, 0.45, 'Silla') },
      { key: 'p:sofa', name: 'Sillón', hint: '2 x 0.9', make: () => makeProp('sofa', 2, 0.9, 'Sillón') },
      { key: 'p:bed', name: 'Cama', hint: '2 x 1.5', make: () => makeProp('bed', 2, 1.5, 'Cama') },
      { key: 'p:desk', name: 'Escritorio', make: () => makeProp('table', 1.4, 0.7, 'Escritorio') },
      { key: 'p:counter', name: 'Barra / cocina', make: () => makeProp('table', 2.4, 0.6, 'Barra') },
      { key: 'p:car', name: 'Auto', hint: '4.5 x 1.8', make: () => makeProp('car', 4.5, 1.8, 'Auto') },
      { key: 'p:plant', name: 'Planta', make: () => makeProp('plant', 0.6, 0.6, 'Planta') },
      { key: 'p:box', name: 'Objeto genérico', make: () => makeProp('box', 0.6, 0.6, 'Objeto') },
      { key: 'power', name: 'Distro / generador', make: () => makePower() },
    ],
  });
  cats.push({
    id: 'set', name: 'Escenografía y textos', items: [
      { key: 'wall', name: 'Pared', hint: 'o usa la herramienta Pared', make: () => makeWall() },
      { key: 'door', name: 'Puerta', make: () => makeDoor() },
      { key: 'window', name: 'Ventana', make: () => makeWindow() },
      { key: 'text', name: 'Texto', make: () => makeText() },
    ],
  });
  return cats;
}

export const GELS: { name: string; mired?: number; color?: string }[] = [
  { name: '' },
  { name: 'Full CTO', mired: 159 },
  { name: '½ CTO', mired: 81 },
  { name: '¼ CTO', mired: 42 },
  { name: '⅛ CTO', mired: 20 },
  { name: 'Full CTB', mired: -131 },
  { name: '½ CTB', mired: -68 },
  { name: '¼ CTB', mired: -30 },
  { name: 'Plus green', color: '#b8f5a0' },
  { name: 'Minus green', color: '#f5b3e6' },
  { name: 'Rojo', color: '#ff3b30' },
  { name: 'Azul', color: '#2f6bff' },
  { name: 'Ámbar', color: '#ffb000' },
  { name: 'Verde', color: '#22c55e' },
  { name: 'Magenta', color: '#e11d74' },
];

export const DIFFUSIONS = ['', 'Opal', '¼ (251)', '½ (250)', 'Full (216)', 'Light grid', '½ grid', 'Full grid', 'Hampshire frost', 'Muslin'];

export const MATERIALS = ['', 'Full grid', '½ grid', '¼ grid', '216', 'Muslin', 'Ultrabounce', 'Griff', 'Bead board', 'Foam core', 'Solid', 'Duvetyne', 'Single net', 'Double net', 'Silk', 'Difusión'];
