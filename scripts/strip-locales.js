/**
 * electron-builder afterPack hook — 仅保留 zh-CN 和 en 语言包
 */
const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) {
    console.log('  • locales dir not found, skipping strip');
    return;
  }

  const keep = new Set(['zh-CN.pak', 'en-US.pak', 'en.pak']);

  const files = fs.readdirSync(localesDir);
  let removed = 0;

  for (const file of files) {
    if (!keep.has(file)) {
      fs.unlinkSync(path.join(localesDir, file));
      removed++;
    }
  }

  console.log(`  • stripped ${removed} unused locale files, kept: ${[...keep].filter(f => files.includes(f)).join(', ')}`);
};
