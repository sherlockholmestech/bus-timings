import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { Coordinate } from '../lib/geo';
import { BusStop } from '../lib/lta';

type LeafletMapProps = {
  center: Coordinate;
  routeLines: Coordinate[][];
  routeServiceNo: string | null;
  selectedStopCode?: string;
  stops: BusStop[];
  theme: 'light' | 'dark';
  locationFocusRequest: number;
  bottomInset: number;
  topInset: number;
  userLocation: Coordinate | null;
  onBoundsChanged: (bounds: { north: number; south: number; east: number; west: number; zoom: number }) => void;
  onStopSelected: (busStopCode: string) => void;
};

export function LeafletMap({
  center,
  routeLines,
  routeServiceNo,
  selectedStopCode,
  stops,
  theme,
  locationFocusRequest,
  bottomInset,
  topInset,
  userLocation,
  onBoundsChanged,
  onStopSelected
}: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(), []);

  const payload = useMemo(
    () => ({
      center,
      routeLines,
      routeServiceNo,
      selectedStopCode,
      stops,
      theme,
      locationFocusRequest,
      bottomInset,
      topInset,
      userLocation
    }),
    [center, routeLines, routeServiceNo, selectedStopCode, stops, theme, locationFocusRequest, bottomInset, topInset, userLocation]
  );

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type: string;
        busStopCode?: string;
        north?: number;
        south?: number;
        east?: number;
        west?: number;
        zoom?: number;
      };
      if (message.type === 'stop-selected' && message.busStopCode) {
        onStopSelected(message.busStopCode);
      }
      if (message.type === 'bounds-changed' && 'north' in message && 'south' in message && 'east' in message && 'west' in message) {
        onBoundsChanged({
          north: Number(message.north),
          south: Number(message.south),
          east: Number(message.east),
          west: Number(message.west),
          zoom: Number(message.zoom)
        });
      }
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
        onLoadEnd={() => {
          webViewRef.current?.postMessage(JSON.stringify(payload));
        }}
        onMessage={onMessage}
      />
      <WebViewBridge payload={payload} webViewRef={webViewRef} />
    </View>
  );
}

function WebViewBridge({
  payload,
  webViewRef
}: {
  payload: unknown;
  webViewRef: React.RefObject<WebView | null>;
}) {
  React.useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  }, [payload, webViewRef]);

  return null;
}

function buildMapHtml() {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    body { background: #f9faf5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .bus-marker {
      align-items: center;
      background: #ffffff;
      border: 2px solid #205EA6;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(16, 24, 40, 0.28);
      color: #205EA6;
      display: flex;
      font-size: 10px;
      font-weight: 800;
      height: 28px;
      justify-content: center;
      width: 42px;
    }
    .bus-marker.selected {
      background: #205EA6;
      border-color: #205EA6;
      color: #ffffff;
    }
    .user-marker {
      background: #00639c;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(16, 24, 40, 0.3);
      height: 18px;
      width: 18px;
    }
    .leaflet-popup-content { margin: 10px 12px; }
    .popup-title { color: #1a1c1a; font-weight: 800; margin-bottom: 2px; }
    .popup-meta { color: #414942; font-size: 12px; }
    .dark-tiles { filter: brightness(0.72) contrast(1.08) saturate(0.78); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([1.3521, 103.8198], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      detectRetina: true,
      updateWhenIdle: true,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let markerLayer = L.layerGroup().addTo(map);
    let routeLayer = L.layerGroup().addTo(map);
    let userMarker = null;
    let lastSelectedFocusKey = null;
    let lastRouteServiceNo = null;
    let lastLocationFocusRequest = 0;
    let boundsTimer = null;

    const post = (message) => {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
    };

    const postBounds = () => {
      const bounds = map.getBounds();
      post({
        type: 'bounds-changed',
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: map.getZoom()
      });
    };

    const scheduleBoundsPost = () => {
      if (boundsTimer) {
        clearTimeout(boundsTimer);
      }
      boundsTimer = setTimeout(postBounds, 120);
    };

    map.on('moveend zoomend', postBounds);
    map.on('move zoom', scheduleBoundsPost);

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));

    const render = (payload) => {
      if (!payload || !payload.center) return;
      const center = payload.center;
      map.invalidateSize(false);
      markerLayer.clearLayers();
      routeLayer.clearLayers();
      const isDark = payload.theme === 'dark';
      document.body.style.background = isDark ? '#111412' : '#f9faf5';
      const tileContainer = tileLayer.getContainer();
      if (tileContainer) {
        tileContainer.classList.toggle('dark-tiles', isDark);
      }

      const routeLines = (payload.routeLines || []).filter((line) => line.length > 1);
      routeLines.forEach((line) => {
        L.polyline(
          line.map((point) => [point.latitude, point.longitude]),
          {
            color: isDark ? '#D0A215' : '#205EA6',
            opacity: 0.58,
            weight: 3,
            dashArray: '8 10',
            lineCap: 'round',
            lineJoin: 'round'
          }
        ).addTo(routeLayer);
      });

      if (payload.routeServiceNo && payload.routeServiceNo !== lastRouteServiceNo && routeLines.length > 0) {
        const bounds = L.latLngBounds(routeLines.flat().map((point) => [point.latitude, point.longitude]));
        map.fitBounds(bounds, {
          paddingTopLeft: [32, Math.max(32, (payload.topInset || 0) + 24)],
          paddingBottomRight: [32, Math.max(32, (payload.bottomInset || 0) + 24)],
          maxZoom: 16
        });
        lastRouteServiceNo = payload.routeServiceNo;
      } else if (!payload.routeServiceNo && lastRouteServiceNo) {
        lastRouteServiceNo = null;
      }

      const selectedFocusKey = payload.selectedStopCode
        ? [
            payload.selectedStopCode,
            center.latitude,
            center.longitude,
            payload.topInset || 0,
            payload.bottomInset || 0
          ].join(':')
        : null;

      if (!payload.routeServiceNo && payload.selectedStopCode && lastSelectedFocusKey !== selectedFocusKey) {
        if (payload.bottomInset) {
          const zoom = 16;
          const size = map.getSize();
          const visibleTop = Math.max(0, payload.topInset || 0);
          const visibleBottom = Math.max(visibleTop + 120, size.y - payload.bottomInset);
          const targetY = visibleTop + (visibleBottom - visibleTop) / 2;
          const stopPoint = map.project([center.latitude, center.longitude], zoom);
          const adjustedCenterPoint = L.point(stopPoint.x, stopPoint.y + size.y / 2 - targetY);
          const adjustedCenter = map.unproject(adjustedCenterPoint, zoom);
          map.setView(adjustedCenter, zoom);
        } else {
          map.setView([center.latitude, center.longitude], 16);
        }
        lastSelectedFocusKey = selectedFocusKey;
        setTimeout(() => {
          map.invalidateSize(false);
          const zoom = map.getZoom();
          const size = map.getSize();
          const visibleTop = Math.max(0, payload.topInset || 0);
          const visibleBottom = Math.max(visibleTop + 120, size.y - (payload.bottomInset || 0));
          const targetY = visibleTop + (visibleBottom - visibleTop) / 2;
          const stopPoint = map.project([center.latitude, center.longitude], zoom);
          const adjustedCenterPoint = L.point(stopPoint.x, stopPoint.y + size.y / 2 - targetY);
          map.setView(map.unproject(adjustedCenterPoint, zoom), zoom, { animate: false });
        }, 80);
      } else if (!payload.selectedStopCode && lastSelectedFocusKey) {
        lastSelectedFocusKey = null;
      }

      if (payload.userLocation && payload.locationFocusRequest && payload.locationFocusRequest !== lastLocationFocusRequest) {
        map.setView([payload.userLocation.latitude, payload.userLocation.longitude], 17);
        lastLocationFocusRequest = payload.locationFocusRequest;
      }

      (payload.stops || []).forEach((stop) => {
        const isSelected = stop.BusStopCode === payload.selectedStopCode;
        const darkStyle = isDark
          ? (isSelected
              ? 'background:#4385BE;color:#100F0F;border-color:#4385BE;'
              : 'background:#1C1B1A;color:#4385BE;border-color:#4385BE;')
          : '';
        const icon = L.divIcon({
          className: '',
          html: '<div class="bus-marker ' + (isSelected ? 'selected' : '') + '" style="' + darkStyle + '">' + stop.BusStopCode + '</div>',
          iconSize: [42, 28],
          iconAnchor: [21, 14]
        });
        const marker = L.marker([stop.Latitude, stop.Longitude], { icon }).addTo(markerLayer);
        marker.bindPopup('<div class="popup-title">' + escapeHtml(stop.Description) + '</div><div class="popup-meta">' + escapeHtml(stop.BusStopCode) + ' · ' + escapeHtml(stop.RoadName) + '</div>');
        marker.on('click', () => post({ type: 'stop-selected', busStopCode: stop.BusStopCode }));
      });

      if (payload.userLocation) {
        const icon = L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
        if (!userMarker) {
          userMarker = L.marker([payload.userLocation.latitude, payload.userLocation.longitude], { icon }).addTo(map);
        } else {
          userMarker.setLatLng([payload.userLocation.latitude, payload.userLocation.longitude]);
        }
      }

      scheduleBoundsPost();
    };

    const receive = (event) => {
      try {
        render(JSON.parse(event.data));
      } catch {}
    };

    document.addEventListener('message', receive);
    window.addEventListener('message', receive);
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  webview: {
    backgroundColor: 'transparent',
    flex: 1
  }
});
