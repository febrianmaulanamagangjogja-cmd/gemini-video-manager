import { chromium } from 'playwright';
import path from 'path';

try {
  const profileDir = path.resolve('browser-profiles', 'akun_1');
  console.log('Using profile:', profileDir);
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
  });

  const page = await ctx.newPage();
  await page.goto('https://gemini.google.com/videos', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const title = await page.title();
  console.log('URL:', page.url());
  console.log('TITLE:', title);

  // Ambil semua elemen input file
  const fileInputs = await page.$$('input[type="file"]');
  console.log('Total file inputs:', fileInputs.length);
  for (let i = 0; i < fileInputs.length; i++) {
    const el = fileInputs[i];
    const outer = await el.evaluate(e => e.outerHTML);
    const visible = await el.isVisible();
    console.log(`Input #${i}: visible=${visible}, html=${outer.slice(0, 150)}`);
  }

  // Cari tombol yang mengandung teks upload/lampirkan
  const buttons = await page.$$eval('button', btns => btns.map(b => ({
    label: b.getAttribute('aria-label') || b.innerText.trim(),
    html: b.outerHTML.slice(0, 100)
  })).filter(b => b.label && (
    b.label.toLowerCase().includes('upload') ||
    b.label.toLowerCase().includes('gambar') ||
    b.label.toLowerCase().includes('image') ||
    b.label.toLowerCase().includes('lampir') ||
    b.label.toLowerCase().includes('file') ||
    b.label.toLowerCase().includes('media') ||
    b.label.toLowerCase().includes('tambah') ||
    b.label.toLowerCase().includes('add')
  )));
  console.log('Relevant upload buttons:', JSON.stringify(buttons, null, 2));

  await ctx.close();
} catch (e) {
  console.error('Error:', e);
}
