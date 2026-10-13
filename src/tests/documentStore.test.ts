import { describe, it, expect, beforeEach } from 'vitest';
import { useDocumentStore } from '../stores/documentStore';
describe('document selection and navigation', () => {
  beforeEach(() =>
    useDocumentStore.setState({
      documents: [],
      activeId: null,
      loading: null,
      errors: [],
    }),
  );
  it('preserves page per file, rejects invalid pages, and selects a remaining file on close', () => {
    const store = useDocumentStore.getState();
    store.add({
      id: 'a',
      name: 'a.pdf',
      format: 'pdf',
      size: 10,
      pageCount: 3,
      currentPage: 0,
    });
    store.add({
      id: 'b',
      name: 'b.tif',
      format: 'tiff',
      size: 20,
      pageCount: 2,
      currentPage: 0,
    });
    store.setPage('a', 2);
    store.select('a');
    store.setPage('a', 3);
    store.setPage('a', -1);
    store.setPage('a', 0.5);
    expect(useDocumentStore.getState().documents[0]?.currentPage).toBe(2);
    store.select('b');
    store.select('a');
    expect(useDocumentStore.getState().documents[0]?.currentPage).toBe(2);
    store.select('missing');
    expect(useDocumentStore.getState().activeId).toBe('a');
    store.remove('a');
    expect(useDocumentStore.getState().activeId).toBe('b');
    store.remove('b');
    expect(useDocumentStore.getState().activeId).toBeNull();
  });
});
