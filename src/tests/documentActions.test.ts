import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDocument } from '../core/document/DocumentLoader';
import {
  uploadFiles,
  closeDocument,
  cancelUpload,
} from '../features/file-upload/documentActions';
import { useDocumentStore } from '../stores/documentStore';
import type { DocumentAdapter } from '../core/document/DocumentModel';
vi.mock('../core/document/DocumentLoader', () => ({ loadDocument: vi.fn() }));
function adapter(): DocumentAdapter {
  return {
    pageCount: 2,
    getPageMetadata: vi.fn(),
    renderPage: vi.fn(),
    dispose: vi.fn(async () => {}),
  };
}
describe('file upload lifecycle', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      documents: [],
      activeId: null,
      errors: [],
      loading: null,
    });
    vi.mocked(loadDocument).mockReset();
  });
  it('continues a batch after an error and disposes admitted document resources on close', async () => {
    const source = adapter();
    vi.mocked(loadDocument)
      .mockRejectedValueOnce(new Error('damaged'))
      .mockResolvedValueOnce({ adapter: source, format: 'pdf' });
    await uploadFiles([
      new File(['bad'], 'bad.pdf'),
      new File(['good'], 'good.pdf'),
    ]);
    const state = useDocumentStore.getState();
    expect(state.documents).toHaveLength(1);
    expect(state.errors[0]).toContain('bad.pdf');
    expect(state.loading).toBeNull();
    await closeDocument(state.documents[0]!.id);
    expect(source.dispose).toHaveBeenCalledOnce();
    expect(useDocumentStore.getState().documents).toHaveLength(0);
  });
  it('cancels in-flight loading and skips subsequent batch entries', async () => {
    vi.mocked(loadDocument).mockImplementation(
      (_file, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true },
          ),
        ),
    );
    const pending = uploadFiles([
      new File(['1'], 'one.pdf'),
      new File(['2'], 'two.pdf'),
    ]);
    cancelUpload();
    await pending;
    expect(loadDocument).toHaveBeenCalledOnce();
    expect(useDocumentStore.getState().documents).toHaveLength(0);
    expect(useDocumentStore.getState().errors).toHaveLength(0);
    expect(useDocumentStore.getState().loading).toBeNull();
  });
  it('rejects inputs beyond the total memory budget before loading them', async () => {
    useDocumentStore.getState().add({
      id: 'large',
      name: 'large.pdf',
      size: 200 * 1024 * 1024,
      format: 'pdf',
      pageCount: 1,
      currentPage: 0,
    });
    await uploadFiles([new File(['1'], 'extra.pdf')]);
    expect(loadDocument).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().errors[0]).toContain('200MB');
  });
});
