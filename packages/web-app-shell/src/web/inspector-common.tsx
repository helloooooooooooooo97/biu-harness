import { PlusIcon, Square2StackIcon } from '@heroicons/react/16/solid'
import type { SlotsService } from '@biu/web-slots'

function InspectorActionStub() {
  return null
}

export function placeCommonInspectorTools(slots: SlotsService) {
  slots.place('inspector-panels', InspectorActionStub, {
    key: 'common-add-view',
    order: -20,
    props: () => ({
      tabId: 'add-view',
      tabLabel: '添加视图',
      tabIcon: PlusIcon,
      common: true,
      action: 'add-view',
    }),
  })
  slots.place('inspector-panels', InspectorActionStub, {
    key: 'common-copy-view',
    order: -19,
    props: () => ({
      tabId: 'copy-view',
      tabLabel: '拷贝视图',
      tabIcon: Square2StackIcon,
      common: true,
      action: 'copy-view',
    }),
  })
}
