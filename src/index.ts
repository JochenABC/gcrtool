import { DecoderUI } from './ui/decoder';
import { EncoderUI } from './ui/encoder';
import { GcrCodec, gcrCodec } from './codec';
import './ui/styles.css';

export { GcrCodec, gcrCodec } from './codec';
export * from './codec/types';
export * from './codec/constants';
export { DecoderUI } from './ui/decoder';
export { EncoderUI } from './ui/encoder';

export const GcrTool = {
  initDecoder(selector: string): DecoderUI {
    return new DecoderUI(selector);
  },

  initEncoder(selector: string): EncoderUI {
    return new EncoderUI(selector);
  },

  codec: gcrCodec,
  GcrCodec
};

// Make available globally for IIFE builds
if (typeof window !== 'undefined') {
  (window as any).GcrTool = GcrTool;
}
