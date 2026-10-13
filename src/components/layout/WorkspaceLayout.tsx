import type { ReactNode } from 'react';

interface Props {
  header: ReactNode;
  documents: ReactNode;
  viewer: ReactNode;
  properties: ReactNode;
  status: ReactNode;
}

export function WorkspaceLayout({
  header,
  documents,
  viewer,
  properties,
  status,
}: Props) {
  return (
    <div className="workspace">
      {header}
      <div className="workspace-body">
        <aside className="panel documents" aria-label="문서 패널">
          {documents}
        </aside>
        <main id="main-content" className="viewer">
          {viewer}
        </main>
        <aside className="panel properties" aria-label="속성 패널">
          {properties}
        </aside>
      </div>
      {status}
    </div>
  );
}
