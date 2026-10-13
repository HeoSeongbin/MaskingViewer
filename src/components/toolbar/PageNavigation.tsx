import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DocumentModel } from '../../core/document/DocumentModel';
import { useDocumentStore } from '../../stores/documentStore';

export function PageNavigation({ document }: { document: DocumentModel }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = (index: number) => {
    useDocumentStore.getState().setPage(document.id, index);
    setValue(null);
    setError('');
  };
  return (
    <form
      className="page-navigation"
      onSubmit={(event) => {
        event.preventDefault();
        const number = Number(value ?? document.currentPage + 1);
        if (
          !Number.isInteger(number) ||
          number < 1 ||
          number > document.pageCount
        ) {
          setError(`1부터 ${document.pageCount}까지 입력하세요.`);
          return;
        }
        navigate(number - 1);
      }}
    >
      {document.currentPage > 0 && (
        <button
          type="button"
          className="icon-button"
          aria-label="이전 페이지"
          onClick={() => navigate(document.currentPage - 1)}
        >
          <ChevronLeft size={17} />
        </button>
      )}
      <label>
        페이지{' '}
        <input
          aria-label="페이지 번호"
          inputMode="numeric"
          value={value ?? document.currentPage + 1}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <span>/ {document.pageCount}</span>
      <button className="text-button" type="submit">
        이동
      </button>
      {document.currentPage < document.pageCount - 1 && (
        <button
          type="button"
          className="icon-button"
          aria-label="다음 페이지"
          onClick={() => navigate(document.currentPage + 1)}
        >
          <ChevronRight size={17} />
        </button>
      )}
      {error && <span role="alert">{error}</span>}
    </form>
  );
}
