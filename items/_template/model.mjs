/* 模板物品 · 三维层（当前为空，用来验证"没有三维也能装配布局"）
 * 真物品在这里建件，导出：
 *   PARTS      [{ key, g:THREE.Object3D, shell?:bool, layer?:number }]
 *   applyMotion(view)        view = { crankDeg, camDeg, running, ... }
 *   bounds(partKeys[])       返回 THREE.Box3（用于拖动包围盒）
 *   createModel(MANIFEST)    可选：把零件装进场景，返回 { install(id), uninstall(id) }
 */
export const PARTS = [];
export function applyMotion() {}
export function createModel() {
  return { install() {}, uninstall() {} };
}
