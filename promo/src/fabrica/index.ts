// Entry point of the video factory: registers only its own templates, so a render
// doesn't load every other composition of the project (and their web fonts).
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Lista } from './Lista';
import { Chat } from './Chat';
import type { Episode } from './head';
import EJEMPLO from './ejemplo.json';

const meta = ({ props }: { props: { episode: Episode } }) => ({ durationInFrames: Math.max(30, Math.round(props.episode.total * 30)) });
const comp = (id: string, component: React.FC<never>) =>
  React.createElement(Composition, { id, component, durationInFrames: 120, fps: 30, width: 1080, height: 1920, defaultProps: { episode: EJEMPLO as Episode }, calculateMetadata: meta } as never);
// one composition per format (scripts/fabrica/formatos/<id>.mjs names its own)
const FabricaRoot: React.FC = () => React.createElement(React.Fragment, null, comp('Lista', Lista as never), comp('Chat', Chat as never));

registerRoot(FabricaRoot);
