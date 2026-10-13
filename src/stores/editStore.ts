import { create } from 'zustand';
import type {
  GeometryEdit,
  Viewport,
} from '../core/geometry/coordinateTransform';
import { DEFAULT_COLOR } from '../core/image/colorTransform';
import type { ColorEdit } from '../core/image/colorTransform';
export interface PageEdit extends GeometryEdit, ColorEdit {}
export const DEFAULT_EDIT: PageEdit = {
  rotation: 0,
  flipX: false,
  flipY: false,
  ...DEFAULT_COLOR,
};
export const pageKey = (id: string, index: number) => `${id}:${index}`;
interface History {
  past: PageEdit[];
  future: PageEdit[];
}
interface EditState {
  displayZoom: Record<string, number>;
  reportZoom: (key: string, zoom: number) => void;
  pages: Record<string, PageEdit>;
  views: Record<string, Viewport>;
  history: Record<string, History>;
  tool: 'inspect' | 'hand';
  update: (key: string, patch: Partial<PageEdit>, record?: boolean) => void;
  commit: (key: string, before: PageEdit) => void;
  undo: (key: string) => void;
  redo: (key: string) => void;
  setView: (key: string, view: Viewport) => void;
  setTool: (tool: EditState['tool']) => void;
  removeDocument: (id: string) => void;
}
const same = (a: PageEdit, b: PageEdit) =>
  JSON.stringify(a) === JSON.stringify(b);
export const isEdited = (edit: PageEdit) => !same(edit, DEFAULT_EDIT);
export const useEditStore = create<EditState>((set) => ({
  displayZoom: {},
  reportZoom: (key, zoom) =>
    set((state) =>
      state.displayZoom[key] === zoom
        ? {}
        : { displayZoom: { ...state.displayZoom, [key]: zoom } },
    ),
  pages: {},
  views: {},
  history: {},
  tool: 'inspect',
  update: (key, patch, record = true) =>
    set((state) => {
      const before = state.pages[key] ?? DEFAULT_EDIT;
      const after = { ...before, ...patch };
      if (same(before, after)) return {};
      const history = state.history[key] ?? { past: [], future: [] };
      return {
        pages: { ...state.pages, [key]: after },
        ...(record
          ? {
              history: {
                ...state.history,
                [key]: {
                  past: [...history.past, before].slice(-100),
                  future: [],
                },
              },
            }
          : {}),
      };
    }),
  commit: (key, before) =>
    set((state) => {
      if (same(before, state.pages[key] ?? DEFAULT_EDIT)) return {};
      const history = state.history[key] ?? { past: [], future: [] };
      return {
        history: {
          ...state.history,
          [key]: { past: [...history.past, before].slice(-100), future: [] },
        },
      };
    }),
  undo: (key) =>
    set((state) => {
      const h = state.history[key];
      const previous = h?.past.at(-1);
      if (!h || !previous) return {};
      return {
        pages: { ...state.pages, [key]: previous },
        history: {
          ...state.history,
          [key]: {
            past: h.past.slice(0, -1),
            future: [...h.future, state.pages[key] ?? DEFAULT_EDIT],
          },
        },
      };
    }),
  redo: (key) =>
    set((state) => {
      const h = state.history[key];
      const next = h?.future.at(-1);
      if (!h || !next) return {};
      return {
        pages: { ...state.pages, [key]: next },
        history: {
          ...state.history,
          [key]: {
            past: [...h.past, state.pages[key] ?? DEFAULT_EDIT],
            future: h.future.slice(0, -1),
          },
        },
      };
    }),
  setView: (key, view) =>
    set((state) => ({ views: { ...state.views, [key]: view } })),
  setTool: (tool) => set({ tool }),
  removeDocument: (id) =>
    set((state) => {
      const keep = <T>(values: Record<string, T>) =>
        Object.fromEntries(
          Object.entries(values).filter(([key]) => !key.startsWith(`${id}:`)),
        );
      return {
        pages: keep(state.pages),
        displayZoom: keep(state.displayZoom),
        views: keep(state.views),
        history: keep(state.history),
      };
    }),
}));
