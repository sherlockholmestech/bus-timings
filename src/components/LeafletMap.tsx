import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { Coordinate } from '../lib/geo';
import { BusStop } from '../lib/lta';
import { isBoundsMessage, isStopSelectedMessage, type RawMapMessage } from '../lib/mapMessageValidation';
import { createMapPayload, type MapPayload } from '../lib/mapPayload';
import { MapBounds } from '../types';

export type { RawMapMessage, MapMessage } from '../lib/mapMessageValidation';

type LeafletMapProps = {
  center: Coordinate;
  routeLines: Coordinate[][];
  routeServiceNo: string | null;
  selectedStopCode: string | null;
  stops: BusStop[];
  theme: 'light' | 'dark';
  locationFocusRequest: number;
  bottomInset: number;
  topInset: number;
  userLocation: Coordinate | null;
  onBoundsChanged: (bounds: MapBounds) => void;
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

  const payload = useMemo<MapPayload>(
    () =>
      createMapPayload({
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
      const message = JSON.parse(event.nativeEvent.data) as RawMapMessage;
      if (isStopSelectedMessage(message)) {
        onStopSelected(message.busStopCode);
      }
      if (isBoundsMessage(message)) {
        onBoundsChanged({
          north: message.north,
          south: message.south,
          east: message.east,
          west: message.west,
          zoom: message.zoom
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
    /* The default Leaflet attribution control sits at bottom-right,
       which the arrivals drawer permanently obscures. We move the
       Leaflet "topright" container down by a top offset (set from
       the bridge payload) so the OSM attribution remains visible
       below the search launcher but above the drawer, in both light
       and dark themes. */
    .leaflet-top.leaflet-right { top: 0; }
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
    // Move the default Leaflet attribution control to the top-right
    // corner. The default bottom-right position is permanently
    // hidden by the arrivals drawer; the render() function then
    // pushes it down by the shell's top inset so it sits below the
    // search launcher and remains visible in both light and dark
    // themes. See VAL-MAP-034.
    map.attributionControl.setPosition('topright');

    let markerLayer = L.layerGroup().addTo(map);
    let routeLayer = L.layerGroup().addTo(map);
    let userMarker = null;
    let lastSelectedFocusKey = null;
    let lastRouteServiceNo = null;
    let lastLocationFocusRequest = 0;
    // Tracks the last normal-mode center we honoured from the
    // bridge payload. When no selected stop, route, or location
    // focus is controlling the map, the render() function honours
    // payload.center changes that differ from the previously
    // applied value. The key is null on the first render so the
    // initial center (Singapore fallback or available user
    // location) is applied exactly once. See VAL-MAP-033.
    let lastNormalCenterKey = null;
    // Tracks the last top offset we applied to the Leaflet
    // "topright" container so the OSM attribution sits below the
    // search launcher in both light and dark themes.
    let lastAttributionTopPx = -1;
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

    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
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

      // Push the OSM attribution control down by the shell's top
      // inset so it sits below the search launcher and remains
      // visible. The top offset is captured in pixels and only
      // re-applied when the shell reports a new value, so we are
      // not touching the DOM on every render.
      const attributionTopPx = (payload.topInset || 0) + 8;
      if (attributionTopPx !== lastAttributionTopPx) {
        const topRightContainer = document.querySelector('.leaflet-top.leaflet-right');
        if (topRightContainer) {
          topRightContainer.style.top = attributionTopPx + 'px';
        }
        lastAttributionTopPx = attributionTopPx;
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
        // Force re-focus on the still-selected stop after the route
        // view closes. Without this reset, the focus key would
        // not change and the map would remain route-fitted even
        // though the selected stop is still active. See
        // VAL-MAP-028.
        lastSelectedFocusKey = null;
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

      // Normal-mode center changes: when no selected stop, route,
      // or explicit location focus is controlling the map, honour
      // payload.center changes from the React Native shell so the
      // startup Singapore fallback and available user-location
      // centering are applied without refocusing on every render
      // and without fighting the user's pan/zoom gestures. The key
      // is computed from the center coordinates and applied when
      // it differs from the previously applied value. The first
      // render (when lastNormalCenterKey is null) also applies
      // the center so the initial payload's startup fallback or
      // user-location center is honoured exactly once. Once
      // applied, the user is free to pan/zoom without the shell
      // re-applying the same center on subsequent renders. See
      // VAL-MAP-033.
      const isNormalMode = !payload.routeServiceNo && !payload.selectedStopCode && !(payload.userLocation && payload.locationFocusRequest && payload.locationFocusRequest !== lastLocationFocusRequest);
      const normalCenterKey = isNormalMode
        ? (Number.isFinite(center.latitude) && Number.isFinite(center.longitude)
            ? center.latitude.toFixed(6) + ':' + center.longitude.toFixed(6)
            : null)
        : null;
      if (normalCenterKey !== null) {
        if (lastNormalCenterKey !== normalCenterKey) {
          // First render (null vs key) and subsequent changes
          // (oldKey vs newKey) both apply the center; unchanged
          // re-renders are a no-op so the user is not refought.
          map.setView([center.latitude, center.longitude], Math.max(map.getZoom(), 12));
        }
        lastNormalCenterKey = normalCenterKey;
      } else {
        lastNormalCenterKey = null;
      }

      (payload.stops || []).forEach((stop) => {
        const isSelected = stop.BusStopCode === payload.selectedStopCode;
        const darkStyle = isDark
          ? (isSelected
              ? 'background:#4385BE;color:#100F0F;border-color:#4385BE;'
              : 'background:#1C1B1A;color:#4385BE;border-color:#4385BE;')
          : '';
        // BusStopCode is escaped before being inserted into the
        // marker HTML so a malformed cached/LTA value cannot
        // inject DOM into the embedded WebView. The popup below
        // already escapes Description/RoadName/BusStopCode; the
        // marker label needed the same treatment to satisfy
        // VAL-MAP-031.
        const icon = L.divIcon({
          className: '',
          html: '<div class="bus-marker ' + (isSelected ? 'selected' : '') + '" style="' + darkStyle + '">' + escapeHtml(stop.BusStopCode) + '</div>',
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
      } else if (userMarker) {
        // payload.userLocation is null: remove the user marker
        // and clear the local reference so a revoked/cleared/
        // unavailable location cannot leave a stale blue dot on
        // the map. Subsequent non-null payloads will recreate the
        // marker via the branch above. See VAL-MAP-027.
        map.removeLayer(userMarker);
        userMarker = null;
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
