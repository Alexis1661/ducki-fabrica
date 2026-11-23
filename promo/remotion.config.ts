import { Config } from '@remotion/cli/config';

// Video-only settings (CRF, pixel format) go on the render command in package.json,
// so an audio-only render (--codec=wav) still works.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
