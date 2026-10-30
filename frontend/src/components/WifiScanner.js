import { Wifi } from '@capacitor-community/wifi'
export async function scanWifi() {
  try {
    const result = await Wifi.scan()
    console.log("Wi-Fi scan results:", result)
    return result
  } catch (err) {
    console.warn("Wi-Fi scanning not supported:", err)
    return []
  }
}
