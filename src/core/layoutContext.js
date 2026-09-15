/**
 * 把根组件算好的布局结果透给任意层级的组件，避免逐层透传
 */
import { inject, provide } from 'vue'

const LAYOUT_KEY = Symbol('constellation-layout')

export function provideLayout(layout) {
  provide(LAYOUT_KEY, layout)
}

export function useLayoutContext() {
  return inject(LAYOUT_KEY, null)
}
