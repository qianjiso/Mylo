#!/usr/bin/env node

// Adhoc 签名，解决 macOS 未签名应用启动慢的问题。
// 仅在 macOS 打包时执行。

const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (process.platform !== 'darwin') {
    return;
  }
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  try {
    execFileSync('codesign', [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--timestamp=none',
      appPath
    ], { stdio: 'inherit' });
    execFileSync('codesign', [
      '--verify',
      '--deep',
      '--strict',
      appPath
    ], { stdio: 'inherit' });
    console.info('[adhoc-sign] completed for', appPath);
  } catch (error) {
    console.error('[adhoc-sign] failed', error);
    throw error;
  }
};
