export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export type GetLocationOptions = PositionOptions & {
  /** Inject for tests / non-browser. Default: navigator.geolocation */
  geolocation?: Geolocation;
};

/** Map GeolocationPositionError.code → Chinese message. */
export function formatGeolocationError(code: number, message?: string): string {
  switch (code) {
    case 1:
      return "定位被拒绝，请在浏览器设置中允许位置权限。";
    case 2:
      return "暂时无法获取位置，请检查设备定位是否开启。";
    case 3:
      return "定位超时，请重试。";
    default:
      return message?.trim() || "定位失败。";
  }
}

/**
 * Read current device position via browser Geolocation API.
 * Call only from client (user gesture recommended).
 */
export function getCurrentLocation(
  options: GetLocationOptions = {},
): Promise<GeoPosition> {
  const { geolocation: injected, ...positionOptions } = options;
  const geo =
    injected ??
    (typeof navigator !== "undefined" ? navigator.geolocation : undefined);

  if (!geo) {
    return Promise.reject(new Error("当前环境不支持定位。"));
  }

  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
      },
      (err) => {
        reject(new Error(formatGeolocationError(err.code, err.message)));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
        ...positionOptions,
      },
    );
  });
}
