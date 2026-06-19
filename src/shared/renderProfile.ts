import { useEffect, useState } from 'react';

export type RenderProfile = 'default' | 'chromium-linux';

function detectRenderProfile(): RenderProfile {
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('renderProfile');
    if (override === 'chromium-linux') return override;
  }

  if (typeof navigator === 'undefined') return 'default';

  const userAgent = navigator.userAgent;
  const userAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = userAgentData.userAgentData?.platform ?? navigator.platform ?? '';
  const isLinux = /linux/i.test(platform) || /x11|linux/i.test(userAgent);
  const isChromium = /Chrom(e|ium)\//.test(userAgent) || /Edg\//.test(userAgent);
  const isFirefox = /Firefox\//.test(userAgent);

  return isLinux && isChromium && !isFirefox ? 'chromium-linux' : 'default';
}

export function useRenderProfile() {
  const [renderProfile, setRenderProfile] = useState<RenderProfile>('default');

  useEffect(() => {
    setRenderProfile(detectRenderProfile());
  }, []);

  return renderProfile;
}
