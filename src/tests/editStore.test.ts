import { beforeEach, it, expect } from 'vitest';
import { DEFAULT_EDIT, useEditStore } from '../stores/editStore';
beforeEach(() =>
  useEditStore.setState({ pages: {}, views: {}, history: {}, tool: 'inspect' }),
);
it('keeps page edits isolated and supports undo/redo, branching and close cleanup', () => {
  const state = useEditStore.getState();
  state.update('doc:0', { rotation: 90 });
  state.update('doc:1', { flipX: true });
  state.undo('doc:0');
  expect(useEditStore.getState().pages['doc:0']).toEqual(DEFAULT_EDIT);
  expect(useEditStore.getState().pages['doc:1']?.flipX).toBe(true);
  state.redo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.rotation).toBe(90);
  state.undo('doc:0');
  state.update('doc:0', { invert: true });
  state.redo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.rotation).toBe(0);
  state.setView('doc:0', { mode: 'manual', zoom: 4, pan: { x: 0, y: 0 } });
  state.removeDocument('doc');
  expect(useEditStore.getState().pages).toEqual({});
  expect(useEditStore.getState().history).toEqual({});
  expect(useEditStore.getState().views).toEqual({});
});
it('groups slider changes into one bounded transaction without storing binaries', () => {
  const state = useEditStore.getState();
  state.update('doc:0', { brightness: 10 }, false);
  state.update('doc:0', { brightness: 30 }, false);
  state.commit('doc:0', DEFAULT_EDIT);
  expect(useEditStore.getState().history['doc:0']?.past).toHaveLength(1);
  state.undo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.brightness).toBe(0);
  for (let i = 0; i < 120; i++) state.update('doc:0', { brightness: i % 100 });
  expect(useEditStore.getState().history['doc:0']?.past).toHaveLength(100);
});
