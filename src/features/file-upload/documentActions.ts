import { loadDocument } from '../../core/document/DocumentLoader';
import { pageRenderer } from '../../core/document/PageRenderer';
import { useDocumentStore } from '../../stores/documentStore';
import { useEditStore } from '../../stores/editStore';

let upload: AbortController | null = null;
const lifetime = new Map<string, AbortController>();
export async function uploadFiles(files: File[]) {
  // File selection is serialized; additional attempts report status without racing.
  const state = useDocumentStore.getState();
  if (upload) {
    state.addError('파일을 여는 중입니다. 완료하거나 취소한 뒤 추가하세요.');
    return;
  }
  const controller = new AbortController();
  upload = controller;
  try {
    for (const [index, file] of files.entries()) {
      if (controller.signal.aborted) break;
      state.setLoading(`${index + 1} / ${files.length} · ${file.name} 열기`);
      try {
        if (useDocumentStore.getState().documents.length >= 50)
          throw new Error(
            '문서는 동시에 50개까지 열 수 있습니다. 사용하지 않는 문서를 닫으세요.',
          );
        if (
          useDocumentStore
            .getState()
            .documents.reduce((sum, doc) => sum + doc.size, 0) +
            file.size >
          200 * 1024 * 1024
        )
          throw new Error(
            '열린 파일의 총 크기는 200MB까지입니다. 문서를 닫고 다시 시도하세요.',
          );
        const { adapter, format } = await loadDocument(file, controller.signal);
        const id = crypto.randomUUID();
        pageRenderer.register(id, adapter);
        lifetime.set(id, new AbortController());
        state.add({
          id,
          name: file.name,
          size: file.size,
          format,
          pageCount: adapter.pageCount,
          currentPage: 0,
          ...(adapter.notice ? { notice: adapter.notice } : {}),
        });
      } catch (error) {
        if (!controller.signal.aborted)
          state.addError(
            `${file.name}: ${error instanceof Error ? error.message : '파일을 열 수 없습니다.'}`,
          );
      }
    }
  } finally {
    if (upload === controller) {
      upload = null;
      state.setLoading(null);
    }
  }
}
export function cancelUpload() {
  upload?.abort();
}
export function documentSignal(id: string) {
  return lifetime.get(id)?.signal;
}
export async function closeDocument(id: string) {
  lifetime.get(id)?.abort();
  lifetime.delete(id);
  useDocumentStore.getState().remove(id);
  useEditStore.getState().removeDocument(id);
  try {
    await pageRenderer.close(id);
  } catch {
    useDocumentStore
      .getState()
      .addError('문서 리소스를 정리하는 중 오류가 발생했습니다.');
  }
}
