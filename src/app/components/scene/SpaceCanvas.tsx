import { memo } from 'react';
import { KurzgesagtBackdrop } from '../KurzgesagtBackdrop';

interface SpaceCanvasProps {
  /** Huidig theme uit de navigatiestate (main/ai/xr/twin/rapid/robotics). */
  theme?: string;
  /** Orientatie: table (liggend) of kiosk (staand). Beïnvloedt framing. */
  surface?: 'table' | 'kiosk';
  /** Hex kleur van de huidig geselecteerde / nearest planet. */
  centralPlanetColor?: string;
  /** Toon de centrale vector-planeet. */
  showCentralPlanet?: boolean;
}

export const SpaceCanvas = memo(function SpaceCanvas({
  theme = 'main',
  surface = 'table',
  centralPlanetColor,
  showCentralPlanet = true,
}: SpaceCanvasProps) {
  return (
    <KurzgesagtBackdrop
      theme={theme}
      surface={surface}
      centralPlanetColor={centralPlanetColor}
      showCentralPlanet={showCentralPlanet}
    />
  );
});
