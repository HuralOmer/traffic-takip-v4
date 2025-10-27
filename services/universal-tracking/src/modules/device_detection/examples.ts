/**
 * Device Detection Usage Examples
 */
import { detectDevice } from './detector.js';
/**
 * Example 1: Android Mobile in Desktop Mode
 */
export async function exampleAndroidMobileDesktopMode() {
  // Simulated: Android mobile with desktop mode enabled
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const result = await detectDevice(userAgent, { debug: true });
  return result;
}
/**
 * Example 2: iPad iOS 13+ (Default Desktop Mode)
 */
export async function exampleiPadDesktopMode() {
  // Simulated: iPad in desktop mode (iOS 13+)
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const result = await detectDevice(userAgent, { debug: true });
  return result;
}
/**
 * Example 3: Normal iPhone
 */
export async function exampleiPhoneNormal() {
  // Simulated: Normal iPhone
  const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const result = await detectDevice(userAgent, { debug: true });
  return result;
}
/**
 * Example 4: Real Desktop Mac
 */
export async function exampleRealMacDesktop() {
  // Simulated: Real Mac desktop
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const result = await detectDevice(userAgent, { debug: true });
  return result;
}
/**
 * Run all examples
 */
export async function runAllExamples() {
  await exampleAndroidMobileDesktopMode();
  await exampleiPadDesktopMode();
  await exampleiPhoneNormal();
  await exampleRealMacDesktop();
}
// For testing in browser console
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.deviceDetectionExamples = {
    runAll: runAllExamples,
    androidMobile: exampleAndroidMobileDesktopMode,
    iPad: exampleiPadDesktopMode,
    iPhone: exampleiPhoneNormal,
    mac: exampleRealMacDesktop,
  };
}
