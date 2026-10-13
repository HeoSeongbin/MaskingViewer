import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { useWorkspaceStore } from '../stores/workspaceStore';

describe('Phase 1 workspace', () => {
  beforeEach(() => useWorkspaceStore.setState({ theme: 'light' }));
  it('exposes all workspace regions and honest unimplemented status', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: '문서 패널' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: '속성 패널' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('contentinfo', { name: '작업 상태' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '문서 편집을 지원합니다. 영구 마스킹·다운로드는 아직 구현되지 않았습니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '문서 열기' }),
    ).toBeInTheDocument();
  });
  it('switches theme in both directions through a real user action', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: '다크 모드로 변경' }));
    expect(container.firstChild).toHaveAttribute('data-theme', 'dark');
    await user.click(
      screen.getByRole('button', { name: '라이트 모드로 변경' }),
    );
    expect(container.firstChild).toHaveAttribute('data-theme', 'light');
  });
});
