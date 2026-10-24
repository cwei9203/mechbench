/* mechbench · 通用零件图标（24×24，描边）
 * 物品在 manifest 里写 icon:'gear' 即可；要自定义就写 icon:'<path d="..."/>' 原样 SVG。
 */
export const ICONS = {
  box:'<rect x="4" y="8" width="16" height="11" rx="1.5"/><path d="M4 12h16M9 8V5h6v3"/>',
  shell:'<path d="M4 9l8-4 8 4v7l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v7"/>',
  shaft:'<path d="M3 12h18"/><path d="M6 9v6M18 9v6"/>',
  gear:'<circle cx="12" cy="12" r="5"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"/>',
  spring:'<path d="M8 4h8M8 20h8"/><path d="M8 6l8 3-8 3 8 3-8 3"/>',
  screw:'<path d="M9 4h6l-1 3H10z"/><path d="M10 7v10l2 3 2-3V7"/><path d="M10 11h4M10 14h4"/>',
  plate:'<path d="M4 14l8-4 8 4-8 4z"/><path d="M7 13l3 1.5"/>',
  disc:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
  piston:'<path d="M7 5h10v7H7z"/><path d="M10 12v6M14 12v6"/><path d="M7 8h10"/>',
  valve:'<path d="M12 4v9"/><path d="M8 16h8l-4 4z"/><path d="M9 4h6"/>',
  coil:'<circle cx="12" cy="12" r="6"/><path d="M12 6v12M9 6.8v10.4M15 6.8v10.4"/>',
  battery:'<rect x="3" y="8" width="15" height="8" rx="1.5"/><path d="M21 11v2"/><path d="M7 10v4M11 10v4"/>',
  bolt:'<path d="M12 4l5 3v6l-5 3-5-3V7z"/><circle cx="12" cy="10" r="2"/>',
  lever:'<path d="M4 18h16"/><path d="M8 18l6-10"/><circle cx="15" cy="7" r="2"/>',
  housing:'<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M8 6V4h8v2M4 12h16"/>',
  pin:'<path d="M5 12h14"/><path d="M8 9v6M16 9v6"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
};

export function iconSvg(name, color) {
  const body = ICONS[name] || ICONS.box;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"${color ? ` style="--pc:${color}"` : ''}>${body}</svg>`;
}
