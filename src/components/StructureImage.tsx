import { useCallback, useEffect, useRef, useState } from 'react';

interface StructureImageProps {
  smiles: string;
  width?: number;
  height?: number;
  className?: string;
  /** 是否启用鼠标悬停放大，默认 false */
  hoverZoom?: boolean;
  /** 放大后的宽度，默认 280 */
  hoverWidth?: number;
  /** 放大后的高度，默认 200 */
  hoverHeight?: number;
}

/**
 * 使用 smiles-drawer 将 SMILES 字符串渲染为 SVG 结构式预览。
 * 自动处理加载状态和空值，渲染失败则降级显示 SMILES 文本。
 * 支持 hoverZoom 鼠标悬停放大。
 */
export default function StructureImage({
  smiles,
  width = 160,
  height = 100,
  className = '',
  hoverZoom = false,
  hoverWidth = 280,
  hoverHeight = 200,
}: StructureImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [popPos, setPopPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [hoverSvgContent, setHoverSvgContent] = useState<string | null>(null);

  const renderSmiles = useCallback((w: number, h: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      import('smiles-drawer').then((mod: any) => {
        const SmilesDrawer = mod.default || mod;
        SmilesDrawer.parse(
          smiles,
          (tree: any) => {
            try {
              const svgDrawer = new SmilesDrawer.SvgDrawer({ width: w, height: h });
              const svgEl = svgDrawer.draw(tree, null, 'light');
              resolve(svgEl.outerHTML);
            } catch (e) {
              reject(e);
            }
          },
          (e: any) => reject(e),
        );
      }).catch(reject);
    });
  }, [smiles]);

  // 渲染小图
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !smiles) return;

    container.innerHTML = '';
    setError(false);

    renderSmiles(width, height)
      .then((html) => {
        if (!container) return;
        container.innerHTML = html;
        const svg = container.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.style.display = 'block';
        }
        setSvgContent(html);
      })
      .catch(() => {
        setError(true);
      });
  }, [smiles, width, height, renderSmiles]);

  // 悬停时预渲染大图
  useEffect(() => {
    if (!hoverZoom || !smiles) return;
    setHoverSvgContent(null);
    renderSmiles(hoverWidth, hoverHeight)
      .then(setHoverSvgContent)
      .catch(() => {});
  }, [smiles, hoverWidth, hoverHeight, hoverZoom, renderSmiles]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!hoverZoom) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // 弹窗默认显示在元素下方，超出右边界则向左偏移
    let left = rect.left;
    if (left + hoverWidth + 16 > window.innerWidth) {
      left = Math.max(8, rect.right - hoverWidth);
    }
    let top = rect.bottom + 8;
    if (top + hoverHeight > window.innerHeight) {
      top = rect.top - hoverHeight - 8;
    }
    setPopPos({ left, top });
    setIsHovered(true);
  }, [hoverZoom, hoverWidth, hoverHeight]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  if (!smiles) return null;

  return (
    <>
      <div
        className={`relative ${className} ${hoverZoom ? 'cursor-zoom-in' : ''}`}
        style={{ width, height, maxWidth: '100%' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: 40 }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
            <span
              className="text-[9px] font-mono text-gray-500 px-1 truncate max-w-full"
              title={smiles}
            >
              {smiles}
            </span>
          </div>
        )}
      </div>

      {/* 悬停放大弹窗 */}
      {hoverZoom && isHovered && hoverSvgContent && (
        <div
          className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 p-md pointer-events-none"
          style={{
            left: popPos.left,
            top: popPos.top,
            width: hoverWidth + 32,
            height: hoverHeight + 16,
          }}
        >
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: hoverSvgContent }}
          />
        </div>
      )}
    </>
  );
}

/** 判断值是否为 SMILES 字符串 */
export function isSmilesLike(value: string | null): boolean {
  if (!value) return false;
  if (value.startsWith('data:') || value.startsWith('http:') || value.startsWith('labnote:')) return false;
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(value)) return false;
  // 方括号、键符、环数字等 SMILES 特征
  return (
    /[=#()\[\]]/.test(value) ||
    /\\|\//.test(value) ||
    /\b[cCnNoOpPsS]\d/.test(value) ||
    /^[A-Z\[][a-z]?/.test(value)
  );
}
