import { create } from 'zustand';
import type { DocumentModel } from '../core/document/DocumentModel';
interface DocumentState {
  documents: DocumentModel[];
  activeId: string | null;
  loading: string | null;
  errors: string[];
  add: (document: DocumentModel) => void;
  select: (id: string) => void;
  setPage: (id: string, index: number) => void;
  remove: (id: string) => void;
  setLoading: (message: string | null) => void;
  addError: (message: string) => void;
  clearErrors: () => void;
}
export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  activeId: null,
  loading: null,
  errors: [],
  add: (document) =>
    set((state) => ({
      documents: [...state.documents, document],
      activeId: document.id,
    })),
  select: (id) =>
    set((state) =>
      state.documents.some((doc) => doc.id === id) ? { activeId: id } : {},
    ),
  setPage: (id, index) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < doc.pageCount
          ? { ...doc, currentPage: index }
          : doc,
      ),
    })),
  remove: (id) =>
    set((state) => {
      const documents = state.documents.filter((doc) => doc.id !== id);
      return {
        documents,
        activeId:
          state.activeId === id ? (documents[0]?.id ?? null) : state.activeId,
      };
    }),
  setLoading: (loading) => set({ loading }),
  addError: (message) =>
    set((state) => ({ errors: [...state.errors.slice(-9), message] })),
  clearErrors: () => set({ errors: [] }),
}));
