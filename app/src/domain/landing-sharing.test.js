import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
test('link previews have static Open Graph metadata without JavaScript',()=>{
  for(const key of ['og:title','og:description','og:image','og:url','og:type']) assert.match(html,new RegExp(`property="${key}" content="[^"]+"`));
  const image=html.match(/property="og:image" content="([^"]+)"/)[1];
  assert.ok(image.startsWith('https://rental-book-equipment.vercel.app/'));
  assert.ok(existsSync(new URL(`../../public${new URL(image).pathname}`,import.meta.url)));
});
test('landing uses a recognizable WhatsApp icon and reduced-motion support',()=>{
  const jsx=readFileSync(new URL('../pages/Landing.jsx',import.meta.url),'utf8');
  assert.match(jsx,/react-icons\/fa/); assert.match(jsx,/<FaWhatsapp/);
  const css=readFileSync(new URL('../pages/landing.css',import.meta.url),'utf8');
  assert.match(css,/prefers-reduced-motion/);
});
