#!/usr/bin/env node
/**
 * Browser verification script for CSP, keyboard shortcuts, and API key obfuscation
 * Run with: node verify-browser.mjs
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const EXTENSION_PATH = '/c/Users/AMAAN/Desktop/Dopaqueue/extension/dist';

const testScript = `
const puppeteer = require('puppeteer');

async function runTests() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--disable-extensions-except=' + EXTENSION_PATH,
      '--load-extension=' + EXTENSION_PATH,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  try {
    // Get the extension ID
    const targets = await browser.targets();
    const extensionTarget = targets.find(t => t.type() === 'service_worker' && t.url().includes('chrome-extension://'));
    const extensionId = extensionTarget ? extensionTarget.url().split('/')[2] : null;
    
    console.log('Extension ID:', extensionId);
    
    // Test 1: CSP Header Check
    const page = await browser.newPage();
    await page.goto('chrome-extension://' + extensionId + '/index.html');
    
    const csp = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta ? meta.getAttribute('content') : 'NOT FOUND';
    });
    console.log('\\n=== CSP Test ===');
    console.log('CSP Meta Tag:', csp);
    console.log(csp && csp.includes("script-src 'self'") ? '✅ PASS: CSP restricts scripts to self' : '❌ FAIL: CSP missing or too permissive');
    
    // Test 2: Keyboard Shortcut
    console.log('\\n=== Keyboard Shortcut Test ===');
    await page.goto('chrome-extension://' + extensionId + '/index.html');
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    
    await new Promise(r => setTimeout(r, 1000));
    
    const shortcutWorked = await page.evaluate(() => {
      return document.body.innerText.includes('Saved') || 
             document.body.innerText.includes('saving') ||
             document.querySelector('[data-test="queue-updated"]') !== null;
    });
    console.log('Shortcut (Ctrl+Shift+S) triggered:', shortcutWorked ? '✅ PASS' : '❌ FAIL (may need manual verification)');
    
    // Test 3: API Key Obfuscation
    console.log('\\n=== API Key Obfuscation Test ===');
    const storageResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['dq_ai_config'], (result) => {
          resolve(result.dq_ai_config);
        });
      });
    });
    
    if (storageResult && storageResult.apiKey) {
      const key = storageResult.apiKey;
      console.log('Stored API key (first 10 chars):', key.substring(0, 10) + '...');
      console.log('Key is obfuscated:', !key.startsWith('sk-') ? '✅ PASS: Key appears obfuscated' : '❌ FAIL: Key in plaintext');
    } else {
      console.log('No API key stored yet - test with real key needed');
    }
    
    // Test 4: i18n language switching
    console.log('\\n=== i18n Test ===');
    const initialText = await page.evaluate(() => document.body.innerText);
    console.log('Initial page text sample:', initialText.substring(0, 100));
    
    // Test 5: Plant visualization renders
    console.log('\\n=== Plant Visualization Test ===');
    const plantSvg = await page.$('svg');
    console.log('Plant SVG found:', plantSvg ? '✅ PASS' : '❌ FAIL');
    
    // Test 6: Dashboard loads
    console.log('\\n=== Dashboard Load Test ===');
    const dashboardPage = await browser.newPage();
    await dashboardPage.goto('chrome-extension://' + extensionId + '/dashboard.html');
    await new Promise(r => setTimeout(r, 2000));
    const dashboardTitle = await dashboardPage.title();
    console.log('Dashboard title:', dashboardTitle);
    console.log('Dashboard loaded:', dashboardTitle.includes('DopaQueue') ? '✅ PASS' : '❌ FAIL');
    
    await browser.close();
    console.log('\\n=== Browser Tests Complete ===');
  } catch (error) {
    console.error('Test error:', error);
    await browser.close();
    process.exit(1);
  }
}

runTests();
`;

writeFileSync('/tmp/verify-browser.js', testScript);
console.log('Browser test script written to /tmp/verify-browser.js');
console.log('Run with: node /tmp/verify-browser.js');
console.log('');
console.log('Note: Requires puppeteer installed (npm install puppeteer)');
console.log('Extension path:', EXTENSION_PATH);