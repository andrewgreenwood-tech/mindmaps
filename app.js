import React, { useState, useMemo, useCallback } from 'react';
import { MindMapNode, LayoutMode, SpacingDensity, ColorThemeId } from './types';
import { parseMarkdown, SAMPLE_TEMPLATES } from './utils/markdownParser';
import { computeMindMapLayout, COLOR_THEMES } from './utils/mindmapLayout';
import { MindMapCanvas } from './components/MindMapCanvas';
import { MarkdownEditor } from './components/MarkdownEditor';
import { Toolbar } from './components/Toolbar';
import { AppJsExportModal } from './components/AppJsExportModal';

export default function App() {
  const [markdown, setMarkdown] = useState<string>(SAMPLE_TEMPLATES[0].markdown);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('balanced');
  const [density, setDensity] = useState<SpacingDensity>('comfortable');
  const [themeId, setThemeId] = useState<ColorThemeId>('modern');
  const [rootImage, setRootImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'editor'>('split');
  const [isAppJsModalOpen, setIsAppJsModalOpen] = useState<boolean>(false);
  const [collapsedMap, setCollapsedMap] = useState<Map<string, boolean>>(new Map());

  // Parse markdown into hierarchical tree
  const rootNode = useMemo(() => {
    return parseMarkdown(markdown, collapsedMap);
  }, [markdown, collapsedMap]);

  // Current active theme
  const currentTheme = COLOR_THEMES[themeId] || COLOR_THEMES.modern;

  // Compute Layout (positions of all nodes & bezier links)
  const { nodes: renderedNodes, links: renderedLinks, bounds } = useMemo(() => {
    return computeMindMapLayout(rootNode, {
      mode: layoutMode,
      density,
      theme: currentTheme,
    });
  }, [rootNode, layoutMode, density, currentTheme]);

  // Search match count
  const searchMatchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const term = searchTerm.toLowerCase().trim();
    return renderedNodes.filter((n) => n.data.title.toLowerCase().includes(term)).length;
  }, [renderedNodes, searchTerm]);

  // Toggle Collapse on a Node
  const handleToggleCollapse = useCallback((nodeTitle: string) => {
    setCollapsedMap((prev) => {
      const next = new Map(prev);
      next.set(nodeTitle, !prev.get(nodeTitle));
      return next;
    });
  }, []);

  // Expand All Nodes
  const handleExpandAll = useCallback(() => {
    setCollapsedMap(new Map());
  }, []);

  // Collapse all primary branches to Level 1
  const handleCollapseAll = useCallback(() => {
    if (!rootNode || !rootNode.children) return;
    const next = new Map<string, boolean>();
    rootNode.children.forEach((c) => {
      next.set(c.title, true);
    });
    setCollapsedMap(next);
  }, [rootNode]);

  // Export Canvas to PNG or SVG
  const handleExportImage = useCallback((format: 'png' | 'svg') => {
    const svgEl = document.getElementById('mindMapSvg') as unknown as SVGSVGElement | null;
    if (!svgEl) return;

    if (format === 'svg') {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgEl);
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmap-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // High-Resolution PNG Export
    const width = Math.max(bounds.maxX - bounds.minX + 160, 1200);
    const height = Math.max(bounds.maxY - bounds.minY + 160, 800);
    const scale = 2; // Retina / 2x resolution

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = currentTheme.canvasBg;
    ctx.fillRect(0, 0, width, height);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `mindmap-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [bounds, currentTheme]);

  return (
    <div id="mindMapAppRoot" className="flex flex-col h-screen w-screen bg-slate-100 overflow-hidden font-sans select-none">
      {/* Top Application Toolbar */}
      <Toolbar
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        density={density}
        onDensityChange={setDensity}
        themeId={themeId}
        onThemeChange={setThemeId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchMatchCount={searchMatchCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onExportImage={handleExportImage}
        onOpenAppJsModal={() => setIsAppJsModalOpen(true)}
      />

      {/* Main Workspace Area */}
      <main id="mainWorkspace" className="flex-1 flex overflow-hidden relative">
        {/* Left Editor Panel */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            id="editorSidebar"
            className={`${
              viewMode === 'split' ? 'w-[380px] xl:w-[440px]' : 'w-full'
            } h-full shrink-0 z-20 transition-all duration-200`}
          >
            <MarkdownEditor
              markdown={markdown}
              onChange={setMarkdown}
              rootImage={rootImage}
              onImageChange={setRootImage}
              onGenerate={() => setViewMode('split')}
            />
          </div>
        )}

        {/* Right Mind Map Canvas View */}
        {(viewMode === 'split' || viewMode === 'map') && (
          <div id="canvasViewport" className="flex-1 h-full relative overflow-hidden bg-slate-50">
            <MindMapCanvas
              rootNode={rootNode}
              renderedNodes={renderedNodes}
              renderedLinks={renderedLinks}
              bounds={bounds}
              theme={currentTheme}
              rootImage={rootImage}
              searchTerm={searchTerm}
              onToggleCollapse={handleToggleCollapse}
              onExportImage={handleExportImage}
            />
          </div>
        )}
      </main>

      {/* Standalone GitHub app.js Exporter Modal */}
      <AppJsExportModal
        isOpen={isAppJsModalOpen}
        onClose={() => setIsAppJsModalOpen(false)}
      />
    </div>
  );
}
