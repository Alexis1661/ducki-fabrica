// Entry point of the video factory: registers only the «Lista» template, so a render
// doesn't load every other composition of the project (and their web fonts).
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Lista } from './Lista';
import type { Episode } from './head';
import EJEMPLO from './ejemplo.json';

const FabricaRoot: React.FC = () =>
  React.createElement(Composition, {
    id: 'Lista',
    component: Lista,
    durationInFrames: 120,
    fps: 30,
    width: 1080,
    height: 1920,
    defaultProps: { episode: EJEMPLO as Episode },
    calculateMetadata: ({ props }: { props: { episode: Episode } }) => ({ durationInFrames: Math.max(30, Math.round(props.episode.total * 30)) }),
  } as never);

registerRoot(FabricaRoot);
