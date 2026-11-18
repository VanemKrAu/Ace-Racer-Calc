// 生成独立的 CDN 映射脚本，避免更新流程向页面插入内联脚本。
export function generateCDNBlock(icons, carImages) {
  const sortedCars = Object.entries(carImages).sort((a, b) => Number(b[0]) - Number(a[0]));
  let source = '// Bilibili CDN image URLs (auto-generated)\n';
  source += 'var _BILI_CDN = true;\n';
  source += 'var _ICONS = ' + JSON.stringify(icons, null, 2) + ';\n';
  source += 'var _CAR_IMG = {\n';
  for (const [id, url] of sortedCars) {
    if (!/^\d+$/.test(id)) throw new Error('非法车辆 ID');
    source += '  ' + id + ': ' + JSON.stringify(url) + ',\n';
  }
  return source + '};\n';
}
