import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './flags.ts';

describe('sanitizeSvg', () => {
  it('retire l’en-tête XML, les commentaires et l’id flag-icons', () => {
    const svg = '<?xml version="1.0"?>\n<!-- c --><svg xmlns="http://www.w3.org/2000/svg" id="flag-icons-fr"><path/></svg>';
    expect(sanitizeSvg(svg)).toBe('<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>\n');
  });

  it('accepte les références internes', () => {
    expect(() => sanitizeSvg('<svg><use xlink:href="#a"/></svg>')).not.toThrow();
  });

  it('refuse les scripts, les gestionnaires d’événements et les liens externes', () => {
    expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrow();
    expect(() => sanitizeSvg('<svg onload="x()"></svg>')).toThrow();
    expect(() => sanitizeSvg('<svg><image href="https://exemple.org/a.png"/></svg>')).toThrow();
  });
});
