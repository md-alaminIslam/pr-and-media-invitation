import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmProvider, ToastProvider } from './ui/ui';
import { HomeScreen } from './app/HomeScreen';
import { ProjectScreen } from './app/ProjectScreen';
import { ExportFormat, ExportScreen } from './app/ExportScreen';
import { getStore } from './editor/store';

type Route = { name: 'home' } | { name: 'project'; project: string; file?: string } | { name: 'export'; path: string; format: ExportFormat };

function parseHash(): Route {
  const x = location.hash.match(/^#\/export\/(pdf|word|print|html)\/(.+)$/);
  if (x) { try { return { name: 'export', format: x[1] as ExportFormat, path: decodeURIComponent(x[2]) }; } catch { return { name: 'home' }; } }
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/(.+))?$/);
  if (!m) return { name: 'home' };
  try { return { name: 'project', project: decodeURIComponent(m[1]), file: m[2] ? decodeURIComponent(m[2]) : undefined }; }
  catch { return { name: 'home' }; }
}

const hashFor = (project: string, file?: string) => `#/p/${encodeURIComponent(project)}${file ? '/' + encodeURIComponent(file) : ''}`;

export default function App() {
  const store = useMemo(() => getStore(), []);
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, []);
  useEffect(() => {
    document.title = route.name === 'project' ? `${route.project} · Media Studio` : 'Media Studio · SAVOR';
  }, [route]);

  const go = (hash: string, replace = false) => {
    // Absolute URL: the page has a <base> pointing at the plugin's asset folder.
    const url = location.pathname + location.search + hash;
    if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
    setRoute(parseHash());
  };

  return (
    <ToastProvider>
      <ConfirmProvider>
        {route.name === 'export'
          ? <ExportScreen store={store} path={route.path} format={route.format} onHome={() => go('#/')} />
          : route.name === 'home'
          ? <HomeScreen store={store} onOpen={(project, file) => go(hashFor(project, file))} />
          : <ProjectScreen key={route.project} store={store} project={route.project} file={route.file}
              onNavigate={file => go(hashFor(route.project, file))} onClose={() => go('#/')} />}
      </ConfirmProvider>
    </ToastProvider>
  );
}
