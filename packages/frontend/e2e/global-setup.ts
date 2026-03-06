import { test as setup } from '@playwright/test';
import { ApiHelper } from './helpers/api.helper';
import * as path from 'path';
import * as fs from 'fs';

const TEST_ADDRESS =
  '0xe2e_test_000000000000000000000000000000000000000000000000000000000001';

setup('authenticate', async ({ browser }) => {
  const api = new ApiHelper();
  await api.login(TEST_ADDRESS);

  const context = await browser.newContext();
  await context.addCookies(api.getCookies());

  // Set localStorage auth-storage for Zustand
  const page = await context.newPage();
  await page.goto('http://localhost:3000/login');
  await page.evaluate(
    (addr) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { isAuthenticated: true, userAddress: addr },
          version: 0,
        }),
      );
    },
    TEST_ADDRESS,
  );

  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({
    path: path.join(authDir, 'storage-state.json'),
  });

  await browser.close();
});
