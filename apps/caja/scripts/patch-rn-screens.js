#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '../node_modules/react-native-screens/common/cpp/react/renderer/components/rnscreens/RNSScreenShadowNode.h'),
  path.join(__dirname, '../node_modules/react-native-screens/common/cpp/react/renderer/components/rnscreens/RNSScreenShadowNode.cpp'),
];

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    console.log(`patch-rn-screens: not found, skipping: ${path.basename(filePath)}`);
    continue;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes('ShadowNode::Shared')) {
    console.log(`patch-rn-screens: no patch needed: ${path.basename(filePath)}`);
    continue;
  }
  const patched = original.replace(
    /const ShadowNode::Shared &/g,
    'const std::shared_ptr<const ShadowNode> &'
  );
  fs.writeFileSync(filePath, patched, 'utf8');
  console.log(`patch-rn-screens: patched ShadowNode::Shared → shared_ptr: ${path.basename(filePath)}`);
}