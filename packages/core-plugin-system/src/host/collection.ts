import type { CollectionSpec } from "@biu/type-file-system";
import type { PluginStoreService } from "./store.ts";

export function pluginsCollection(store: PluginStoreService): CollectionSpec {
  const find = async (id: string) =>
    (await store.list()).find((row) => row.id === id) ?? null;
  return {
    id: "plugins",
    path: "/plugins",
    label: "插件",
    view: {
      moduleId: "plugins",
      route: "/plugins",
      title: "插件",
      inspector: true,
      blurb: "",
      order: 30,
      icon: "puzzle-piece",
    },
    schema: {
      labelField: "name",
      columns: ["name", "blurb", "running", "tags"],
      fields: {
        name: { type: "string", label: "名称" },
        blurb: { type: "string", label: "简介" },
        enabled: { type: "boolean", label: "已打开" },
        running: { type: "boolean", label: "运行中" },
        tags: { type: "multi-select", label: "标签" },
        bytes: { type: "bytes", label: "大小" },
        lastRunAt: { type: "datetime", label: "上次运行" },
        hasHost: { type: "boolean", label: "Host" },
        hasWeb: { type: "boolean", label: "Web" },
        author: { type: "string", label: "作者" },
        authorUrl: { type: "url", label: "作者链接" },
      },
    },
    list: () => store.list(),
    get: find,
    actions: [
      {
        id: "start",
        label: "运行",
        when: { running: false },
        run: async (id) => {
          await store.openPlugin(id);
        },
      },
      {
        id: "stop",
        label: "停止",
        when: { running: true },
        run: async (id) => {
          await store.close(id);
        },
      },
      {
        id: "uninstall",
        label: "卸载",
        tone: "danger",
        confirm: "确定卸载这个插件？代码会被删掉。",
        run: async (id) => {
          await store.uninstall(id);
        },
      },
    ],
  };
}
